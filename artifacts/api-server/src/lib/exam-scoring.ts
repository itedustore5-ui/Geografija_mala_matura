import type { GridSpec, Question } from "../data/types";
import { isScored } from "../data/types";
import {
  cellsOf,
  fieldAccepted,
  parseCells,
  partCorrect,
  scoreAnswer,
  splitParts,
} from "./scoring";

/**
 * Бодовање теста са завршног испита — по упутству за прегледање Завода.
 *
 * Сва упутства (2023–2026) имају исто правило:
 *   − задатак доноси највише 1 бод;
 *   − за сваки одговор који се разликује од решења ученик добија 0 бодова;
 *   − 0,5 бодова само где упутство то предвиђа (`halfPoint`), и увек на исти
 *     начин: тачно је све осим једне ставке, а та ставка је остављена празна
 *     („тачна три одговора – 1 бод; тачна два одговора и ниједан нетачан –
 *     0,5 бодова“).
 *
 * Зато „две тачне и једна погрешна“ тврдња не носи ништа: нетачан одговор
 * поништава делимичне поене. Раније је овде стајало сразмерно бодовање (две од
 * три тачне = 0,5 и уз погрешну трећу), које ниједан кључ не примењује; тада
 * још ниједан тест није био унет, па промена није дирала сачуване покушаје.
 */

const round = (value: number) => Math.round(value * 100) / 100;

/** Ставке задатка: колико их има, колико је тачно, колико погрешно — остало је празно. */
type Units = { total: number; correct: number; wrong: number };

const parseIndices = (answer: string) =>
  answer
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .map(Number)
    .filter((n) => Number.isInteger(n));

/**
 * Позиција у одговору која показује избор; празна ставка је у клијенту -1 или
 * празан низ, па се не броји ни као тачна ни као погрешна.
 */
const chosenAt = (answer: string, i: number): number | null => {
  const raw = answer.split(",")[i]?.trim();
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

/**
 * Ред табеле је тачан кад су у њему обојени тачно прави кружићи, а празан кад
 * у њему нема ниједног — ред у коме по кључу не треба бојити ништа тако је
 * тачан само ако је остао празан.
 */
function gridUnits(grid: GridSpec, answer: string): Units {
  const given = parseCells(answer);
  const correct = cellsOf(grid.correctCells);
  const inRow = (cells: Set<string>, row: number) =>
    [...cells]
      .filter((c) => c.startsWith(`${row}-`))
      .sort()
      .join(",");

  let ok = 0;
  let bad = 0;
  grid.rows.forEach((_, row) => {
    const mine = inRow(given, row);
    if (mine === inRow(correct, row)) ok++;
    else if (mine !== "") bad++;
  });
  return { total: grid.rows.length, correct: ok, wrong: bad };
}

/** Ставке задатка по типу; `null` за задатке који немају ставке (једноструки избор). */
function unitsOf(q: Question, answer: string): Units | null {
  switch (q.type) {
    case "tf": {
      const given = answer.split(",").map((v) => v.trim().toUpperCase());
      let ok = 0;
      let bad = 0;
      q.correct.forEach((expected, i) => {
        const mine = given[i];
        if (mine !== "T" && mine !== "N") return;
        if ((mine === "T") === expected) ok++;
        else bad++;
      });
      return { total: q.correct.length, correct: ok, wrong: bad };
    }

    case "grid":
      return gridUnits(q, answer);

    case "match":
    case "order": {
      const expected = q.type === "match" ? q.correctPairs : q.correctOrder;
      let ok = 0;
      let bad = 0;
      expected.forEach((v, i) => {
        const mine = chosenAt(answer, i);
        if (mine === null || (q.type === "order" && mine === 0)) return;
        if (mine === v) ok++;
        else bad++;
      });
      return { total: expected.length, correct: ok, wrong: bad };
    }

    case "multi":
    case "pick": {
      const correct = new Set(q.type === "multi" ? q.correctAnswers : q.correctTokens);
      let ok = 0;
      let bad = 0;
      for (const g of new Set(parseIndices(answer))) {
        if (correct.has(g)) ok++;
        else bad++;
      }
      return { total: correct.size, correct: ok, wrong: bad };
    }

    case "fill": {
      const given = answer.split("|");
      let ok = 0;
      let bad = 0;
      q.fields.forEach((field, i) => {
        const mine = given[i] ?? "";
        if (mine.trim() === "") return;
        if (fieldAccepted(field.accepted, mine)) ok++;
        else bad++;
      });
      return { total: q.fields.length, correct: ok, wrong: bad };
    }

    case "parts": {
      const given = splitParts(answer, q.parts.length);
      let ok = 0;
      let bad = 0;
      q.parts.forEach((part, i) => {
        const mine = given[i]!;
        if (mine.trim() === "") return;
        if (partCorrect(part, mine)) ok++;
        else bad++;
      });
      return { total: q.parts.length, correct: ok, wrong: bad };
    }

    default:
      return null;
  }
}

export function scoreExamAnswer(question: Question, answer: string): number {
  if (!isScored(question)) return 0;
  if (!answer || answer.trim() === "") return 0;

  if (scoreAnswer(question, answer)) return round(question.points);
  if (!question.halfPoint) return 0;

  const units = unitsOf(question, answer);
  if (!units || units.total < 2) return 0;
  return units.wrong === 0 && units.correct === units.total - 1
    ? round(question.points / 2)
    : 0;
}

/** Да ли задатак уопште има ставке на које се пола бода може односити. */
export const supportsHalfPoint = (q: Question) => {
  const units = unitsOf(q, "");
  return units !== null && units.total >= 2;
};

export function scoreExam(
  questions: Question[],
  answers: Map<number, string>,
): { earned: number; total: number } {
  let earned = 0;
  let total = 0;
  for (const q of questions) {
    if (!isScored(q)) continue; // задаци писања се не уносе у укупан збир
    total += q.points;
    earned += scoreExamAnswer(q, answers.get(q.id) ?? "");
  }
  return { earned: round(earned), total: round(total) };
}
