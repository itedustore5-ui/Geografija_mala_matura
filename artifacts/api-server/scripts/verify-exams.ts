/**
 * Проверава тестове са претходних завршних испита:
 *   1. да су задаци непротивречни (индекси у опсегу, слике постоје, текст не
 *      меша писма),
 *   2. да збир поена задатака одговара пријављеном укупном броју поена,
 *   3. да тачно решен тест носи максималан број поена, а празан ниједан,
 *   4. да пола бода стиже тачно онако како каже упутство за прегледање: кад је
 *      једна ставка празна, а ниједна погрешна — и никад кад је нека погрешна,
 *   5. да у ономе што иде клијенту нема тачних одговора.
 *
 * Провера 2 хвата грешку која се иначе примети тек кад ученик преда тест:
 * ако при уносу теста промакне један задатак, укупан број поена се не поклапа,
 * а проценат који ученик види је нетачан за све који су тест већ радили.
 * Провера 4 је ту јер је тест мерни инструмент студије: погрешно пола бода
 * мења зависну променљиву свима који тест ураде.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exams } from "../src/data/exams";
import { isScored, type GridSpec, type Part, type Question } from "../src/data/types";
import { sanitizeQuestion } from "../src/lib/scoring";
import { scoreExam, scoreExamAnswer, supportsHalfPoint } from "../src/lib/exam-scoring";

const here = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.resolve(here, "../../geografija-kviz/public/images");

const problems: string[] = [];

const cellsAnswer = (correctCells: number[][]) =>
  correctCells.flatMap((cols, row) => cols.map((col) => `${row}-${col}`)).join(",");

const partAnswer = (p: Part) =>
  p.kind === "choice" ? String(p.correctAnswer) : cellsAnswer(p.correctCells);

function correctAnswerFor(q: Question): string | null {
  switch (q.type) {
    case "single":
      return String(q.correctAnswer);
    case "multi":
      return q.correctAnswers.join(",");
    case "fill":
      return q.fields.map((f) => f.accepted[0]).join("|");
    case "match":
      return q.correctPairs.join(",");
    case "order":
      return q.correctOrder.join(",");
    case "tf":
      return q.correct.map((v) => (v ? "T" : "N")).join(",");
    case "grid":
      return cellsAnswer(q.correctCells);
    case "pick":
      return q.correctTokens.join(",");
    case "parts":
      return q.parts.map(partAnswer).join(";");
    default:
      return null;
  }
}

/**
 * Тачан одговор у коме је једна ставка празна, односно погрешна, а све остале
 * тачне. `null` где тип нема ставке.
 */
function variantsFor(q: Question): { blank: string; wrong: string } | null {
  switch (q.type) {
    case "tf": {
      const ok = q.correct.map((v) => (v ? "T" : "N"));
      const last = ok.length - 1;
      return {
        blank: ok.map((v, i) => (i === last ? "" : v)).join(","),
        wrong: ok.map((v, i) => (i === last ? (v === "T" ? "N" : "T") : v)).join(","),
      };
    }
    case "grid": {
      const row = [...q.correctCells.keys()].reverse().find((r) => q.correctCells[r]!.length > 0);
      if (row === undefined) return null;
      const blank = q.correctCells.map((cols, r) => (r === row ? [] : cols));
      const wrongCol = (q.correctCells[row]![0]! + 1) % q.columns.length;
      const wrong = q.correctCells.map((cols, r) => (r === row ? [wrongCol] : cols));
      return { blank: cellsAnswer(blank), wrong: cellsAnswer(wrong) };
    }
    case "multi":
    case "pick": {
      const correct = q.type === "multi" ? q.correctAnswers : q.correctTokens;
      const count = q.type === "multi" ? q.options.length : q.tokens.length;
      const unused = [...Array(count).keys()].find((i) => !correct.includes(i));
      const kept = correct.slice(0, -1);
      return {
        blank: kept.join(","),
        wrong: unused === undefined ? kept.join(",") : [...kept, unused].join(","),
      };
    }
    case "match":
    case "order": {
      const ok = q.type === "match" ? q.correctPairs : q.correctOrder;
      const size = q.type === "match" ? q.rightItems.length : q.items.length;
      const last = ok.length - 1;
      const other = q.type === "match" ? (ok[last]! + 1) % size : (ok[last]! % size) + 1;
      return {
        blank: ok.map((v, i) => (i === last ? -1 : v)).join(","),
        wrong: ok.map((v, i) => (i === last ? other : v)).join(","),
      };
    }
    case "fill": {
      const ok = q.fields.map((f) => f.accepted[0]!);
      const last = ok.length - 1;
      return {
        blank: ok.map((v, i) => (i === last ? "" : v)).join("|"),
        wrong: ok.map((v, i) => (i === last ? "нетачно" : v)).join("|"),
      };
    }
    case "parts": {
      const ok = q.parts.map(partAnswer);
      const last = ok.length - 1;
      const p = q.parts[last]!;
      const wrongLast =
        p.kind === "choice"
          ? String((p.correctAnswer + 1) % p.options.length)
          : cellsAnswer(p.correctCells.map((cols) => cols.map((c) => (c + 1) % p.columns.length)));
      return {
        blank: ok.map((v, i) => (i === last ? "" : v)).join(";"),
        wrong: ok.map((v, i) => (i === last ? wrongLast : v)).join(";"),
      };
    }
    default:
      return null;
  }
}

// Тражи се у целом стаблу: код задатака из више делова тачан одговор би
// стајао у самом делу.
const FORBIDDEN_KEYS = new Set([
  "correctAnswer",
  "correctAnswers",
  "correctPairs",
  "correctOrder",
  "correctCells",
  "correctParts",
  "correctTokens",
  "correct",
  "accepted",
  "acceptable",
  "unacceptable",
  "explanation",
  "standard",
  "halfPoint",
]);

function forbiddenIn(value: unknown, found: Set<string>) {
  if (Array.isArray(value)) value.forEach((v) => forbiddenIn(v, found));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k)) found.add(k);
      forbiddenIn(v, found);
    }
  }
}

// Званични PDF зна да има латинично слово усред ћириличке речи („морe je“ у
// тесту 2024). На папиру се не види, а у апликацији би поређење и претрага
// пукли, па се сваки текст проверава као и у збирци.
const isLetter = (ch: string) => /\p{L}/u.test(ch);
const isCyrillic = (ch: string) => /\p{Script=Cyrillic}/u.test(ch);

function mixedWords(value: string): string[] {
  return value
    .split(/[\s ]+/)
    .filter((w) => [...w].some(isCyrillic) && [...w].some((ch) => isLetter(ch) && !isCyrillic(ch)));
}

function textsOf(q: Question): string[] {
  const gridTexts = (g: GridSpec) => [...g.rows, ...g.columns];
  const out = [q.question, q.explanation, q.passage ?? "", q.source ?? ""];
  switch (q.type) {
    case "single":
    case "multi":
      out.push(...q.options);
      break;
    case "tf":
      out.push(...q.statements);
      break;
    case "grid":
      out.push(...gridTexts(q));
      break;
    case "match":
      out.push(...q.leftItems, ...q.rightItems);
      break;
    case "order":
      out.push(...q.items);
      break;
    case "fill":
      q.fields.forEach((f) => out.push(f.label, ...f.accepted));
      break;
    case "pick":
      out.push(...q.tokens);
      break;
    case "parts":
      q.parts.forEach((p) =>
        p.kind === "grid"
          ? out.push(p.text, ...gridTexts(p))
          : out.push(p.text, p.after ?? "", ...p.options),
      );
      break;
    case "open":
      out.push(q.acceptable);
      break;
  }
  return out;
}

function checkStructure(q: Question, fail: (m: string) => void) {
  const inRange = (i: number, n: number) => Number.isInteger(i) && i >= 0 && i < n;
  if (!q.question.trim()) fail(`задатак ${q.id}: нема текста захтева`);
  if (!q.explanation.trim()) fail(`задатак ${q.id}: нема објашњења`);
  if (q.image && !fs.existsSync(path.join(imagesDir, q.image)))
    fail(`задатак ${q.id}: нема слике „${q.image}“ у public/images`);
  switch (q.type) {
    case "single":
      if (!inRange(q.correctAnswer, q.options.length)) fail(`задатак ${q.id}: тачан одговор ван понуђених`);
      break;
    case "multi":
      if (q.correctAnswers.length === 0 || q.correctAnswers.some((i) => !inRange(i, q.options.length)))
        fail(`задатак ${q.id}: тачни одговори ван понуђених`);
      break;
    case "tf":
      if (q.correct.length !== q.statements.length) fail(`задатак ${q.id}: број тачних вредности ≠ број тврдњи`);
      break;
    case "grid":
      if (q.correctCells.length !== q.rows.length) fail(`задатак ${q.id}: тачна поља нису дата за сваки ред`);
      if (q.correctCells.some((cols) => cols.some((c) => !inRange(c, q.columns.length))))
        fail(`задатак ${q.id}: поље ван табеле`);
      break;
    default:
      break;
  }
}

for (const exam of exams) {
  const fail = (message: string) => problems.push(`${exam.key}: ${message}`);

  const ids = new Set<number>();
  for (const q of exam.questions) {
    if (ids.has(q.id)) fail(`број задатка ${q.id} се понавља`);
    ids.add(q.id);
    if (q.textKey && !exam.texts.some((t) => t.key === q.textKey))
      fail(`задатак ${q.id} тражи текст „${q.textKey}“ којег нема у тесту`);
    checkStructure(q, fail);
    for (const word of textsOf(q).flatMap(mixedWords))
      fail(`задатак ${q.id}: реч „${word}“ меша ћирилицу са другим писмом`);
  }

  const sum = exam.questions.filter(isScored).reduce((acc, q) => acc + q.points, 0);
  if (Math.abs(sum - exam.totalPoints) > 0.001)
    fail(`збир поена је ${sum}, а тест је пријављен као ${exam.totalPoints}`);

  const full = new Map<number, string>();
  for (const q of exam.questions) {
    const a = correctAnswerFor(q);
    if (a !== null) full.set(q.id, a);
  }

  const perfect = scoreExam(exam.questions, full);
  if (Math.abs(perfect.earned - perfect.total) > 0.001)
    fail(`тачно решен тест носи ${perfect.earned} од ${perfect.total} поена`);

  const empty = scoreExam(exam.questions, new Map());
  if (empty.earned !== 0) fail("празан тест носи поене");

  for (const q of exam.questions) {
    if (!isScored(q)) continue;

    if (q.halfPoint && !supportsHalfPoint(q))
      fail(`задатак ${q.id}: пола бода је означено, а задатак нема ставке`);

    const v = variantsFor(q);
    if (v) {
      const blank = scoreExamAnswer(q, v.blank);
      const wrong = scoreExamAnswer(q, v.wrong);
      const expectedBlank = q.halfPoint ? q.points / 2 : 0;
      if (Math.abs(blank - expectedBlank) > 0.001)
        fail(`задатак ${q.id}: једна празна ставка носи ${blank}, а по упутству ${expectedBlank}`);
      if (wrong !== 0) fail(`задатак ${q.id}: једна погрешна ставка носи ${wrong}, а по упутству 0`);
    }

    const found = new Set<string>();
    forbiddenIn(sanitizeQuestion(q), found);
    for (const key of found) fail(`задатак ${q.id}: поље „${key}“ стиже клијенту`);
  }
}

if (exams.length === 0) {
  console.log("Још није унет ниједан тест са претходних завршних испита.");
  console.log("Тестови се уносе са: node scripts/import-exam.mjs <fajl.json>");
} else {
  console.log(`Тестова: ${exams.length}`);
  for (const e of exams) {
    const half = e.questions.filter((q) => q.halfPoint).length;
    console.log(
      `  ${e.label} — ${e.questions.length} задатака, ${e.totalPoints} поена (пола бода могуће у ${half})`,
    );
  }
}

if (problems.length > 0) {
  console.error(`\nНађено ${problems.length} проблема:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("\nСве провере су прошле.");
