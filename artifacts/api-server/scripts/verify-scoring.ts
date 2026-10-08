/**
 * Проверава да збирка задатака и бодовање стоје:
 *   1. да су подаци о задацима непротивречни (индекси у опсегу, без дупликата,
 *      без рупа у бројевима, слике постоје),
 *   2. да тачан одговор носи поен, а промењен одговор не носи,
 *   3. да у ономе што иде клијенту пре одговора нема тачног одговора.
 *
 * Трећа провера је овде разлог зашто скрипта уопште постоји. Цурење тачног
 * одговора се не види ни на једном екрану — само у мрежном саобраћају — па би
 * иначе прошло непримећено док неко не отвори Network таб.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { questions } from "../src/data/questions";
import {
  BLOCKS,
  blockOf,
  isScored,
  type DataTable,
  type GridSpec,
  type Part,
  type Question,
} from "../src/data/types";
import { sanitizeQuestion, scoreAnswer } from "../src/lib/scoring";

const here = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.resolve(here, "../../geografija-kviz/public/images");

const problems: string[] = [];
const fail = (q: Question, message: string) => problems.push(`Задатак ${q.id}: ${message}`);

/** Одговор на табелу: обојена поља као „ред-колона“. */
const cellsAnswer = (correctCells: number[][]) =>
  correctCells.flatMap((cols, row) => cols.map((col) => `${row}-${col}`)).join(",");

/** Иста табела са једним кружићем више или мање — сигурно нетачна. */
const toggledCells = (grid: GridSpec) => {
  const cells = grid.correctCells.map((cols) => [...cols]);
  const first = cells[0]!;
  if (first.length > 0) first.pop();
  else first.push(0);
  return cellsAnswer(cells);
};

const partAnswer = (part: Part) =>
  part.kind === "choice" ? String(part.correctAnswer) : cellsAnswer(part.correctCells);

const wrongPartAnswer = (part: Part) =>
  part.kind === "choice"
    ? String((part.correctAnswer + 1) % part.options.length)
    : toggledCells(part);

// ── 1. Структура ───────────────────────────────────────────────────────────
function checkGrid(q: Question, grid: GridSpec, where: string) {
  if (grid.rows.length === 0) fail(q, `${where}: табела нема редова`);
  if (grid.columns.length < 2) fail(q, `${where}: табела има мање од две колоне`);
  if (grid.correctCells.length !== grid.rows.length)
    fail(q, `${where}: тачна поља нису дата за сваки ред`);
  grid.correctCells.forEach((cols, row) => {
    if (new Set(cols).size !== cols.length) fail(q, `${where}: у реду ${row + 1} се поље понавља`);
    for (const c of cols)
      if (c < 0 || c >= grid.columns.length)
        fail(q, `${where}: у реду ${row + 1} поље ${c} је ван табеле`);
  });
  if (grid.correctCells.every((cols) => cols.length === 0))
    fail(q, `${where}: ни у једном реду не треба бојити ништа`);
  if (grid.columnImages && grid.columnImages.length !== grid.columns.length)
    fail(q, `${where}: број слика не одговара броју колона`);
  if (grid.rowImages && grid.rowImages.length !== grid.rows.length)
    fail(q, `${where}: број слика не одговара броју редова`);
}

const imagesOf = (q: Question): string[] => {
  const gridImages = (g: GridSpec) => [...(g.columnImages ?? []), ...(g.rowImages ?? [])];
  return [
    ...(q.image ? [q.image] : []),
    ...((q.type === "single" || q.type === "multi") && q.optionImages ? q.optionImages : []),
    ...(q.type === "grid" ? gridImages(q) : []),
    ...(q.type === "parts" ? q.parts.flatMap((p) => (p.kind === "grid" ? gridImages(p) : [])) : []),
  ];
};

const seen = new Set<number>();
for (const q of questions) {
  if (seen.has(q.id)) fail(q, "број задатка се понавља");
  seen.add(q.id);

  if (!blockOf(q.id)) fail(q, "број није ни у једној целини збирке (121–240)");
  if (q.points <= 0) fail(q, "број поена мора бити већи од нуле");
  // Задатак из делова сме бити без заједничког захтева (у збирци почиње одмах
  // са „А)“), али онда сваки део мора имати свој.
  if (!q.question.trim() && q.type !== "parts") fail(q, "нема текста захтева");
  if (q.type === "parts" && !q.question.trim() && q.parts.some((p) => !p.text.trim()))
    fail(q, "задатак нема заједнички захтев, а неки део нема свој");
  if (!q.explanation.trim()) fail(q, "нема објашњења");

  // Слика која не постоји на екрану изгледа као задатак без прилога, а не као
  // грешка — ученик би решавао карту коју не види.
  for (const img of imagesOf(q)) {
    if (!fs.existsSync(path.join(imagesDir, img))) fail(q, `нема слике „${img}“ у public/images`);
  }

  if (q.table) {
    const width = (row: DataTable["head"]) =>
      row.reduce((n, c) => n + (typeof c === "string" ? 1 : (c.colSpan ?? 1)), 0);
    if (q.table.head.length === 0) fail(q, "табела нема заглавље");
    if (q.table.rows.length === 0) fail(q, "табела нема ниједан ред");
    // Ред који почиње ћелијом са rowSpan ужи је за ту колону у редовима
    // испод; проверава се само да ниједан ред није шири од заглавља.
    for (const [i, row] of q.table.rows.entries())
      if (width(row) > width(q.table.head)) fail(q, `ред ${i + 1} табеле је шири од заглавља`);
  }

  switch (q.type) {
    case "single":
      if (q.options.length < 2) fail(q, "мање од два понуђена одговора");
      if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length)
        fail(q, "тачан одговор показује ван понуђених");
      if (q.optionImages && q.optionImages.length !== q.options.length)
        fail(q, "број слика не одговара броју понуђених одговора");
      break;
    case "multi":
      if (q.correctAnswers.length === 0) fail(q, "нема ниједног тачног одговора");
      if (new Set(q.correctAnswers).size !== q.correctAnswers.length)
        fail(q, "тачан одговор се понавља");
      for (const i of q.correctAnswers)
        if (i < 0 || i >= q.options.length) fail(q, `индекс ${i} је ван понуђених`);
      if (q.optionImages && q.optionImages.length !== q.options.length)
        fail(q, "број слика не одговара броју понуђених одговора");
      break;
    case "fill":
      if (q.fields.length === 0) fail(q, "нема поља за допуну");
      for (const f of q.fields)
        if (f.accepted.length === 0) fail(q, `поље „${f.label}“ нема ниједан прихватљив облик`);
      break;
    case "match":
      if (q.correctPairs.length !== q.leftItems.length)
        fail(q, "број парова не одговара броју ставки леве колоне");
      for (const i of q.correctPairs)
        if (i < 0 || i >= q.rightItems.length) fail(q, `пар ${i} показује ван десне колоне`);
      if (q.extraRight && q.rightItems.length <= q.leftItems.length)
        fail(q, "означено је да има вишка, а десна колона није дужа");
      break;
    case "order": {
      const expected = [...Array(q.items.length)].map((_, i) => i + 1);
      const sorted = [...q.correctOrder].sort((a, b) => a - b);
      if (q.correctOrder.length !== q.items.length || sorted.some((v, i) => v !== expected[i]))
        fail(q, "редослед мора бити пермутација позиција 1..н");
      break;
    }
    case "tf":
      if (q.correct.length !== q.statements.length)
        fail(q, "број тачних вредности не одговара броју тврдњи");
      break;
    case "grid":
      checkGrid(q, q, "табела");
      break;
    case "pick":
      if (q.correctTokens.length === 0) fail(q, "нема означених делова текста");
      for (const i of q.correctTokens)
        if (i < 0 || i >= q.tokens.length) fail(q, `означен део ${i} не постоји`);
      break;
    case "parts":
      if (q.parts.length < 2) fail(q, "задатак из делова има мање од два дела");
      q.parts.forEach((part, i) => {
        const where = `део ${i + 1}`;
        if (part.kind === "grid") {
          checkGrid(q, part, where);
          return;
        }
        if (part.options.length < 2) fail(q, `${where}: мање од два понуђена одговора`);
        if (part.correctAnswer < 0 || part.correctAnswer >= part.options.length)
          fail(q, `${where}: тачан одговор показује ван понуђених`);
        if (part.after !== undefined && !part.inline)
          fail(q, `${where}: наставак реченице има смисла само уз избор у реченици`);
      });
      break;
    case "open":
      if (!q.acceptable.trim()) fail(q, "нема модела прихватљивог одговора");
      break;
  }
}

// Рупа у бројевима значи да је задатак прескочен при преписивању. У збирци за
// српски недостајале су две стране скена, а то се открило тек на крају.
const missing: number[] = [];
for (const b of BLOCKS) for (let id = b.from; id <= b.to; id++) if (!seen.has(id)) missing.push(id);

// ── 1б. Текст: мешање писама и подебљања ───────────────────────────────────
// Текст који види ученик мора бити ћирилички. Латинично слово усред ћириличке
// речи је увек грешка у куцању, а на екрану се готово не примећује.
// Провера тражи слово из *било ког* другог писма, не само латинице. Римски
// бројеви („XIX“), ознаке страна света („N, S, W, E“) и мерне јединице
// („km²“) су засебне речи и провера их не дира.
const isLetter = (ch: string) => /\p{L}/u.test(ch);
const isCyrillic = (ch: string) => /\p{Script=Cyrillic}/u.test(ch);

function checkText(q: Question, label: string, value: string) {
  for (const word of value.split(/[\s ]+/)) {
    if (![...word].some(isCyrillic)) continue;
    const stray = [...word].find((ch) => isLetter(ch) && !isCyrillic(ch));
    if (stray) {
      fail(q, `${label}: реч „${word}“ меша ћирилицу и слово „${stray}“ из другог писма`);
    }
  }
  // Незатворено подебљање би на екрану подебљало пола задатка.
  if ((value.match(/\*\*/g) ?? []).length % 2 !== 0) fail(q, `${label}: подебљање „**“ није затворено`);
}

const cellText = (c: DataTable["head"][number]) => (typeof c === "string" ? c : c.text);

function checkGridText(q: Question, grid: GridSpec, where: string) {
  grid.rows.forEach((t, i) => checkText(q, `${where}, ред ${i + 1}`, t));
  grid.columns.forEach((t, i) => checkText(q, `${where}, колона ${i + 1}`, t));
}

for (const q of questions) {
  checkText(q, "захтев", q.question);
  checkText(q, "објашњење", q.explanation);
  if (q.passage) checkText(q, "одломак", q.passage);
  if (q.source) checkText(q, "извор", q.source);
  if (q.table) {
    if (q.table.caption) checkText(q, "наслов табеле", q.table.caption);
    [...q.table.head, ...q.table.rows.flat()].forEach((c) =>
      checkText(q, "ћелија табеле", cellText(c)),
    );
  }
  if (q.type === "single" || q.type === "multi")
    q.options.forEach((o, i) => checkText(q, `одговор ${i + 1}`, o));
  if (q.type === "pick") q.tokens.forEach((t, i) => checkText(q, `део ${i + 1}`, t));
  if (q.type === "tf") q.statements.forEach((s, i) => checkText(q, `тврдња ${i + 1}`, s));
  if (q.type === "match") {
    q.leftItems.forEach((t, i) => checkText(q, `лева ставка ${i + 1}`, t));
    q.rightItems.forEach((t, i) => checkText(q, `десна ставка ${i + 1}`, t));
  }
  if (q.type === "grid") checkGridText(q, q, "табела");
  if (q.type === "order") q.items.forEach((t, i) => checkText(q, `ставка ${i + 1}`, t));
  if (q.type === "fill") {
    if (q.hint) checkText(q, "напомена", q.hint);
    q.fields.forEach((f, i) => {
      checkText(q, `поље ${i + 1}`, f.label);
      f.accepted.forEach((a) => checkText(q, `прихватљив одговор ${i + 1}`, a));
    });
  }
  if (q.type === "parts")
    q.parts.forEach((part, i) => {
      const where = `део ${i + 1}`;
      checkText(q, where, part.text);
      if (part.kind === "grid") checkGridText(q, part, where);
      else {
        if (part.after) checkText(q, `${where}, наставак`, part.after);
        part.options.forEach((o, j) => checkText(q, `${where}, одговор ${j + 1}`, o));
      }
    });
  if (q.type === "open") checkText(q, "модел одговора", q.acceptable);
}

// ── 2. Бодовање ────────────────────────────────────────────────────────────
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

for (const q of questions) {
  if (!isScored(q)) {
    if (scoreAnswer(q, "било шта")) fail(q, "задатак који се не бодује добио је поен");
    continue;
  }

  const correct = correctAnswerFor(q);
  if (correct === null) continue;
  if (!scoreAnswer(q, correct)) fail(q, "тачан одговор није признат");
  if (scoreAnswer(q, "")) fail(q, "празан одговор је признат као тачан");

  // Сваки прихватљив облик мора стварно да прође — облик који нормализација
  // поквари (нпр. тачка на крају, зарез) изгледа прихваћено, а није.
  if (q.type === "fill") {
    q.fields.forEach((f, i) => {
      for (const variant of f.accepted) {
        const answer = q.fields.map((g, j) => (j === i ? variant : g.accepted[0])).join("|");
        if (!scoreAnswer(q, answer)) fail(q, `облик „${variant}“ у пољу ${i + 1} није признат`);
      }
    });
  }

  // Промењен одговор не сме да прође. Свака грана мења одговор на начин који
  // за тај тип задатка сигурно даје нешто друго.
  let wrong: string | null = null;
  if (q.type === "single") {
    wrong = String((q.correctAnswer + 1) % q.options.length);
  } else if (q.type === "multi") {
    const unused = q.options.map((_, i) => i).find((i) => !q.correctAnswers.includes(i));
    wrong = unused === undefined ? null : [...q.correctAnswers, unused].join(",");
  } else if (q.type === "tf") {
    wrong = q.correct.map((v) => (v ? "N" : "T")).join(",");
  } else if (q.type === "grid") {
    wrong = toggledCells(q);
  } else if (q.type === "pick" && q.correctTokens.length < q.tokens.length) {
    const unused = q.tokens.map((_, i) => i).find((i) => !q.correctTokens.includes(i));
    wrong = [...q.correctTokens, unused!].join(",");
  } else if (q.type === "match" && q.rightItems.length > 1) {
    wrong = q.correctPairs
      .map((v, i) => (i === 0 ? (v + 1) % q.rightItems.length : v))
      .join(",");
  } else if (q.type === "order" && q.items.length > 1) {
    const flipped = [...q.correctOrder];
    [flipped[0], flipped[1]] = [flipped[1]!, flipped[0]!];
    wrong = flipped.join(",");
  } else if (q.type === "fill") {
    wrong = q.fields.map(() => "нетачно").join("|");
  } else if (q.type === "parts") {
    wrong = q.parts.map((p, i) => (i === 0 ? wrongPartAnswer(p) : partAnswer(p))).join(";");
  }
  if (wrong !== null && wrong !== correct && scoreAnswer(q, wrong))
    fail(q, "нетачан одговор је признат као тачан");

  // Делимично тачан одговор не сме да прође: један изостављен кружић, или
  // сваки део осим последњег.
  if (q.type === "multi" && q.correctAnswers.length > 1) {
    if (scoreAnswer(q, q.correctAnswers.slice(0, -1).join(",")))
      fail(q, "делимично тачан одговор је признат као тачан");
  }
  if (q.type === "parts") {
    const allButLast = q.parts.map((p, i) => (i < q.parts.length - 1 ? partAnswer(p) : "")).join(";");
    if (scoreAnswer(q, allButLast)) fail(q, "одговор без последњег дела је признат као тачан");
  }
  // Табела у којој је обојено све не сме да прође — иначе би ученик који
  // обоји сваки кружић добио поен без знања.
  if (q.type === "grid") {
    const all = q.rows
      .flatMap((_, r) => q.columns.map((__, c) => `${r}-${c}`))
      .join(",");
    if (scoreAnswer(q, all)) fail(q, "табела са свим обојеним кружићима је призната");
  }
}

// ── 3. Цурење тачног одговора ──────────────────────────────────────────────
// Поља се траже у целом стаблу, не само на првом нивоу: код задатака из више
// делова тачан одговор би стајао у самом делу (`parts[1].correctAnswer`).
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

for (const q of questions) {
  const sanitized = sanitizeQuestion(q) as Record<string, unknown>;
  const found = new Set<string>();
  forbiddenIn(sanitized, found);
  for (const key of found) fail(q, `поље „${key}“ стиже клијенту пре одговора`);

  // Текст тачног одговора не сме да се појави ни као вредност неког другог
  // поља — на пример у објашњењу залуталом у `question`. Табела се ту не
  // гледа: одговор се из ње чита (месец највећег протицаја у 181), па је
  // податак у табели део задатка, а не цурење.
  const { table: _table, ...rest } = sanitized;
  const serialized = JSON.stringify(rest);
  if (q.type === "fill") {
    for (const field of q.fields) {
      for (const variant of field.accepted) {
        if (variant.length > 3 && serialized.includes(`"${variant}"`))
          fail(q, `прихватљив одговор „${variant}“ стиже клијенту`);
      }
    }
  }
  if (q.type === "open" && serialized.includes(q.acceptable.slice(0, 40)))
    fail(q, "модел одговора стиже клијенту пре одговора");
}

// ── Извештај ───────────────────────────────────────────────────────────────
const scoredCount = questions.filter(isScored).length;
console.log(`Задатака у збирци: ${questions.length} (бодује се ${scoredCount}).`);
for (const b of BLOCKS) {
  const inBlock = questions.filter((q) => blockOf(q.id) === b.key);
  const types = new Map<string, number>();
  for (const q of inBlock) types.set(q.type, (types.get(q.type) ?? 0) + 1);
  const summary = [...types].map(([t, n]) => `${t} ${n}`).join(", ");
  console.log(`  ${b.label} (${b.pages}): ${inBlock.length} — ${summary}`);
}

if (missing.length > 0) {
  console.log(`\nНедостају задаци: ${missing.join(", ")}`);
}

if (problems.length > 0) {
  console.error(`\nНађено ${problems.length} проблема:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

if (missing.length > 0) process.exit(1);

console.log("\nСве провере су прошле.");
