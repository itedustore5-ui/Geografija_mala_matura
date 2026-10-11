import type { DataTable, GridSpec, Part, Question } from "../data/types";
import { isScored } from "../data/types";

/**
 * Одговор ученика се преноси као стринг јер долази кроз једно поље у бази
 * (`quiz_attempts.answers`). Формат по типу задатка:
 *   single  "2"
 *   multi   "0,3"                 (индекси, редослед небитан)
 *   fill    "реч|друга реч"       (поља раздвојена усправном цртом)
 *   match   "1,0,2"               (за сваку леву ставку индекс десне)
 *   order   "2,1,3"               (за сваку ставку њена позиција)
 *   tf      "T,N,T"
 *   grid    "0-1,2-0,2-3"         (обојена поља као ред-колона)
 *   pick    "1,4,7"               (индекси изабраних жетона)
 *   parts   "0;1;0-2,1-0"         (делови раздвојени тачка-зарезом, сваки у
 *                                  формату свог дела; ниједан тај формат не
 *                                  садржи „;“)
 *   open    слободан текст        (не бодује се)
 */

/**
 * Поређење слободно уписаног одговора.
 *
 * Ћирилица и латиница се НЕ изједначавају: на завршном испиту се пише
 * ћирилицом, а ученик који упише „Kopaonik“ уместо „Копаоник“ тамо не би
 * добио поен. Изједначавање писама дало би поен који на испиту не би добио,
 * па би вежба лагала о спремности.
 *
 * Изједначавају се само размаци око зареза и врста цртице: то је куцање, а
 * не знање.
 */
const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "");

/** Да ли се упис у једно поље признаје; користи га и бодовање испита по ставкама. */
export const fieldAccepted = (accepted: string[], value: string) =>
  accepted.some((variant) => normalize(variant) === normalize(value));

const parseIndices = (answer: string) =>
  answer
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map(Number)
    .filter((n) => Number.isInteger(n));

const sameSet = (a: number[], b: number[]) => {
  const x = [...new Set(a)].sort((m, n) => m - n);
  const y = [...new Set(b)].sort((m, n) => m - n);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * Избор једног одговора. Празан стринг није „0“: `Number("")` је нула, па би
 * ученик који ништа не обоји добио поен где год је тачан први одговор.
 */
const parseChoice = (answer: string): number | null =>
  /^\s*\d+\s*$/.test(answer) ? Number(answer) : null;

/** Обојена поља табеле; све што није облика „ред-колона“ се одбацује. */
export const parseCells = (answer: string): Set<string> =>
  new Set(
    answer
      .split(",")
      .map((p) => p.trim())
      .filter((p) => /^\d+-\d+$/.test(p)),
  );

export const cellsOf = (correctCells: number[][]): Set<string> =>
  new Set(correctCells.flatMap((cols, row) => cols.map((col) => `${row}-${col}`)));

const sameCells = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((c) => b.has(c));

const gridCorrect = (grid: GridSpec, answer: string) =>
  sameCells(parseCells(answer), cellsOf(grid.correctCells));

/** Одговор на задатак са деловима, раздељен по деловима. */
export const splitParts = (answer: string, count: number): string[] => {
  const given = answer.split(";");
  return [...Array(count)].map((_, i) => given[i] ?? "");
};

export function partCorrect(part: Part, answer: string): boolean {
  if (part.kind === "choice") return parseChoice(answer) === part.correctAnswer;
  return gridCorrect(part, answer);
}

/**
 * Бодовање је све-или-ништа по задатку: делимично тачан одговор на задатку
 * вредном 1 поен не носи пола поена. Делимичне поене признаје само бодовање
 * теста са завршног испита (`exam-scoring.ts`).
 */
export function scoreAnswer(question: Question, answer: string): boolean {
  if (!isScored(question)) return false;
  if (answer === undefined || answer === null || answer.trim() === "") return false;

  switch (question.type) {
    case "single":
      return parseChoice(answer) === question.correctAnswer;

    case "multi":
      return sameSet(parseIndices(answer), question.correctAnswers);

    case "fill": {
      const given = answer.split("|");
      if (given.length !== question.fields.length) return false;
      return question.fields.every((field, i) => fieldAccepted(field.accepted, given[i] ?? ""));
    }

    case "match": {
      const given = parseIndices(answer);
      return (
        given.length === question.correctPairs.length &&
        given.every((v, i) => v === question.correctPairs[i])
      );
    }

    case "order": {
      const given = parseIndices(answer);
      return (
        given.length === question.correctOrder.length &&
        given.every((v, i) => v === question.correctOrder[i])
      );
    }

    case "tf": {
      const given = answer.split(",").map((v) => v.trim().toUpperCase());
      return (
        given.length === question.correct.length &&
        question.correct.every((v, i) => (v ? given[i] === "T" : given[i] === "N"))
      );
    }

    case "grid":
      return gridCorrect(question, answer);

    case "pick":
      return sameSet(parseIndices(answer), question.correctTokens);

    case "parts": {
      if (answer.split(";").length !== question.parts.length) return false;
      const given = splitParts(answer, question.parts.length);
      return question.parts.every((part, i) => partCorrect(part, given[i]!));
    }

    default:
      return false;
  }
}

/** Табела онако како је види ученик — без тачних поља. */
export type SanitizedGrid = {
  rows: string[];
  columns: string[];
  columnImages?: string[];
  rowImages?: string[];
};

export type SanitizedPart =
  | {
      kind: "choice";
      label?: string;
      text: string;
      after?: string;
      inline?: boolean;
      options: string[];
    }
  | ({ kind: "grid"; label?: string; text: string } & SanitizedGrid);

/** Задатак онако како га види ученик пре него што одговори. */
export type SanitizedQuestion = {
  id: number;
  textKey?: string;
  points: number;
  type: Question["type"];
  question: string;
  passage?: string;
  source?: string;
  image?: string;
  table?: DataTable;
  scored: boolean;
  options?: string[];
  optionImages?: string[];
  fields?: { label: string }[];
  hint?: string;
  leftItems?: string[];
  rightItems?: string[];
  extraRight?: boolean;
  items?: string[];
  statements?: string[];
  trueLabel?: string;
  falseLabel?: string;
  rows?: string[];
  columns?: string[];
  columnImages?: string[];
  rowImages?: string[];
  tokens?: string[];
  lines?: number;
  parts?: SanitizedPart[];
};

const copyTable = (table: DataTable): DataTable => ({
  ...(table.caption !== undefined ? { caption: table.caption } : {}),
  head: table.head.map((c) => (typeof c === "string" ? c : { ...c })),
  rows: table.rows.map((row) => row.map((c) => (typeof c === "string" ? c : { ...c }))),
});

const copyGrid = (grid: GridSpec): SanitizedGrid => {
  const out: SanitizedGrid = { rows: [...grid.rows], columns: [...grid.columns] };
  if (grid.columnImages !== undefined) out.columnImages = [...grid.columnImages];
  if (grid.rowImages !== undefined) out.rowImages = [...grid.rowImages];
  return out;
};

/** Део задатка, поље по поље — `correctAnswer` и `correctCells` остају на серверу. */
function sanitizePart(part: Part): SanitizedPart {
  if (part.kind === "choice") {
    const out: SanitizedPart = { kind: "choice", text: part.text, options: [...part.options] };
    if (part.label !== undefined) out.label = part.label;
    if (part.after !== undefined) out.after = part.after;
    if (part.inline !== undefined) out.inline = part.inline;
    return out;
  }
  const out: SanitizedPart = { kind: "grid", text: part.text, ...copyGrid(part) };
  if (part.label !== undefined) out.label = part.label;
  return out;
}

/**
 * Гради се поље по поље, никад преко `{...q}`.
 * Разлог: спред би при сваком новом пољу у моделу задатка (нпр. `correctAnswer`)
 * тихо почео да шаље тачан одговор клијенту, а то се не би видело ни на једном
 * екрану — тек у мрежном саобраћају. Верификатор `verify:scoring` ово проверава.
 */
export function sanitizeQuestion(q: Question): SanitizedQuestion {
  const base: SanitizedQuestion = {
    id: q.id,
    points: q.points,
    type: q.type,
    question: q.question,
    scored: isScored(q),
  };
  if (q.textKey !== undefined) base.textKey = q.textKey;
  if (q.passage !== undefined) base.passage = q.passage;
  if (q.source !== undefined) base.source = q.source;
  if (q.image !== undefined) base.image = q.image;
  if (q.table !== undefined) base.table = copyTable(q.table);

  switch (q.type) {
    case "single":
    case "multi":
      base.options = [...q.options];
      if (q.optionImages !== undefined) base.optionImages = [...q.optionImages];
      break;
    case "fill":
      base.fields = q.fields.map((f) => ({ label: f.label }));
      if (q.hint !== undefined) base.hint = q.hint;
      break;
    case "match":
      base.leftItems = [...q.leftItems];
      base.rightItems = [...q.rightItems];
      if (q.extraRight !== undefined) base.extraRight = q.extraRight;
      break;
    case "order":
      base.items = [...q.items];
      break;
    case "tf":
      base.statements = [...q.statements];
      if (q.trueLabel !== undefined) base.trueLabel = q.trueLabel;
      if (q.falseLabel !== undefined) base.falseLabel = q.falseLabel;
      break;
    case "grid": {
      const grid = copyGrid(q);
      base.rows = grid.rows;
      base.columns = grid.columns;
      if (grid.columnImages !== undefined) base.columnImages = grid.columnImages;
      if (grid.rowImages !== undefined) base.rowImages = grid.rowImages;
      break;
    }
    case "pick":
      base.tokens = [...q.tokens];
      break;
    case "open":
      if (q.lines !== undefined) base.lines = q.lines;
      break;
    case "parts":
      base.parts = q.parts.map(sanitizePart);
      break;
  }

  return base;
}

/** Тачан одговор дела задатка — стиже клијенту тек после предаје. */
export type RevealedPart = { correctAnswer: number } | { correctCells: number[][] };

/** Тачан одговор и објашњење — шаље се тек пошто је ученик предао одговор. */
export type RevealedQuestion = {
  id: number;
  explanation: string;
  correctAnswer?: number;
  correctAnswers?: number[];
  correctFields?: string[][];
  correctPairs?: number[];
  correctOrder?: number[];
  correct?: boolean[];
  correctCells?: number[][];
  correctTokens?: number[];
  correctParts?: RevealedPart[];
  acceptable?: string;
  unacceptable?: string;
};

export function revealQuestion(q: Question): RevealedQuestion {
  const out: RevealedQuestion = { id: q.id, explanation: q.explanation };

  switch (q.type) {
    case "single":
      out.correctAnswer = q.correctAnswer;
      break;
    case "multi":
      out.correctAnswers = [...q.correctAnswers];
      break;
    case "fill":
      out.correctFields = q.fields.map((f) => [...f.accepted]);
      break;
    case "match":
      out.correctPairs = [...q.correctPairs];
      break;
    case "order":
      out.correctOrder = [...q.correctOrder];
      break;
    case "tf":
      out.correct = [...q.correct];
      break;
    case "grid":
      out.correctCells = q.correctCells.map((cols) => [...cols]);
      break;
    case "pick":
      out.correctTokens = [...q.correctTokens];
      break;
    case "parts":
      out.correctParts = q.parts.map((part) =>
        part.kind === "choice"
          ? { correctAnswer: part.correctAnswer }
          : { correctCells: part.correctCells.map((cols) => [...cols]) },
      );
      break;
    case "open":
      out.acceptable = q.acceptable;
      if (q.unacceptable !== undefined) out.unacceptable = q.unacceptable;
      break;
  }

  return out;
}
