import { Fragment, useMemo } from "react";
import type { DataTable, Question, QuestionPart, Revealed, TableCell } from "@/lib/api";

/**
 * Приказ једног задатка.
 *
 * Изглед намерно прати збирку: одговори стоје иза празних кружића које ученик
 * „боји“, повезивање је табела са кружићима у пољима, а избор у реченици има
 * кружић испод појма. Ученик који вежба из књиге и решава овде треба да види
 * исти задатак, а не да преводи једно у друго.
 *
 * Иста компонента ради и док се решава и у прегледу решења; разлика је у томе
 * што у прегледу стиже `reveal`. Клијент нигде не одлучује шта је тачно —
 * `correct` долази са сервера.
 */

type Props = {
  index: number;
  question: Question;
  answer: string;
  onChange: (value: string) => void;
  reveal?: Revealed;
  correct?: boolean;
  earnedPoints?: number;
  /** Сопствена оцена за задатке писања; null док ученик не одлучи. */
  selfMark?: boolean | null;
  onSelfMark?: (correct: boolean) => void;
};

const parse = (answer: string) =>
  answer
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .map(Number);

const imageUrl = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

/**
 * Подебљано у књизи стоји између две звездице. Подебљање носи значење —
 * „обој **кружиће**“ је једини знак да се бира више одговора — па се не губи.
 */
function Rich({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

/**
 * Код `pick` задатака жетони већ исписују цео текст, па би одломак изнад њих
 * приказао исту реченицу двапут — ученик тражи где је разлика, а разлике нема.
 * Одломак остаје само кад носи нешто чега у жетонима нема (увод, наслов).
 */
function showPassage(question: Question): boolean {
  if (!question.passage) return false;
  if (question.type !== "pick") return true;
  const flat = (s: string) => s.replace(/\s+/g, " ").trim();
  return flat(question.tokens?.join(" ") ?? "") !== flat(question.passage);
}

/**
 * После провере кружић каже четири ствари: тачно обојен, требало га је
 * обојити (зелени обруч), погрешно обојен, или ништа. Без „требало је“
 * ученик у табели не би разликовао свој тачан избор од оног који је
 * пропустио.
 */
type CircleState = "empty" | "filled" | "correct" | "missed" | "wrong";

/** Кружић какав стоји у збирци: празан обод који се боји. */
function Circle({ state, size = 18 }: { state: CircleState; size?: number }) {
  const cls =
    state === "correct"
      ? "border-emerald-500 bg-emerald-500"
      : state === "missed"
        ? "border-emerald-500 bg-emerald-500/20"
        : state === "wrong"
          ? "border-rose-500 bg-rose-500"
          : state === "filled"
            ? "border-foreground bg-foreground"
            : "border-muted-foreground/70";

  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 rounded-full border-2 ${cls}`}
    />
  );
}

/** Стање кружића: пре предаје прати избор, после предаје тачност. */
function circleState(chosen: boolean, isCorrect: boolean, locked: boolean): CircleState {
  if (!locked) return chosen ? "filled" : "empty";
  if (isCorrect) return chosen ? "correct" : "missed";
  if (chosen) return "wrong";
  return "empty";
}

export function QuestionView({
  index,
  question,
  answer,
  onChange,
  reveal,
  correct,
  earnedPoints,
  selfMark,
  onSelfMark,
}: Props) {
  const locked = reveal !== undefined;
  const selected = useMemo(() => parse(answer), [answer]);

  // Задатке писања сервер не бодује, па исход прати сопствену оцену.
  const outcome = question.scored ? correct : (selfMark ?? undefined);

  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-6">
      {/*
        На телефону број и поени иду у први ред, а захтев испод њих преко целе
        ширине: између броја и ознаке поена остало би му једва сто тридесет
        пиксела, па би и кратак захтев заузео пола екрана.
      */}
      <header className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="text-lg font-semibold tabular-nums">{index}.</span>
        {question.question || question.hint ? (
          <div className="order-3 w-full sm:order-2 sm:w-auto sm:min-w-0 sm:flex-1">
            <p className="whitespace-pre-line text-[15px] leading-relaxed">
              <Rich text={question.question} />
            </p>
            {question.hint ? (
              <p className="mt-1 text-sm text-muted-foreground">{question.hint}</p>
            ) : null}
          </div>
        ) : null}
        <span className="order-2 ml-auto shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground sm:order-3">
          {earnedPoints !== undefined
            ? `${earnedPoints}/${question.points}`
            : locked && outcome !== undefined
              ? `${outcome ? question.points : 0}/${question.points}`
              : `${question.points} поен${question.points === 1 ? "" : "а"}`}
        </span>
      </header>

      {/*
        Карте и графици се на телефону смање, а натписи на њима су ситни;
        додир отвара слику у пуној величини, где може да се увећа прстима.
      */}
      {question.image ? (
        <a href={imageUrl(question.image)} target="_blank" rel="noreferrer" className="mb-4 block">
          <img
            src={imageUrl(question.image)}
            alt="Прилог уз задатак"
            className="mx-auto max-h-[70vh] w-auto max-w-full rounded-lg border border-border bg-white"
          />
          <span className="mt-1 block text-center text-xs text-muted-foreground">
            додирни слику за увећање
          </span>
        </a>
      ) : null}

      {question.table ? <DataTableView table={question.table} /> : null}

      {showPassage(question) ? (
        <blockquote className="mb-4 whitespace-pre-line border-l-2 border-border pl-4 text-[15px] leading-relaxed">
          <Rich text={question.passage!} />
        </blockquote>
      ) : null}

      {question.source ? (
        <p className="mb-4 text-right text-sm italic text-muted-foreground">
          ({question.source})
        </p>
      ) : null}

      <Body
        question={question}
        answer={answer}
        selected={selected}
        onChange={onChange}
        locked={locked}
        reveal={reveal}
      />

      {reveal ? (
        <Reveal
          question={question}
          reveal={reveal}
          selfMark={selfMark}
          onSelfMark={onSelfMark}
        />
      ) : null}
    </article>
  );
}

/**
 * Табела уз задатак, са спојеним ћелијама као у збирци.
 *
 * Широка табела (протицај Дунава по месецима, тринаест колона) на телефону се
 * окреће: месеци иду у редове. Иначе би ученик скроловао у страну тражећи јун,
 * а табела од три колоне и дванаест редова стане на сваки екран.
 */
function DataTableView({ table }: { table: DataTable }) {
  const cell = (c: TableCell) =>
    typeof c === "string" ? { text: c, rowSpan: undefined, colSpan: undefined } : c;

  const plain = [table.head, ...table.rows].every((row) =>
    row.every((c) => typeof c === "string"),
  );
  const turnOnPhone = plain && table.head.length > 6;

  return (
    <>
      {turnOnPhone ? <TransposedTable table={table} /> : null}
      <div className={`mb-4 overflow-x-auto ${turnOnPhone ? "hidden sm:block" : ""}`}>
        <table className="w-full border-collapse text-sm">
          {table.caption ? (
            <caption className="border border-b-0 border-border px-3 py-2 font-semibold">
              {table.caption}
            </caption>
          ) : null}
          <thead>
            <tr>
              {table.head.map((raw, j) => {
                const c = cell(raw);
                return (
                  <th
                    key={j}
                    rowSpan={c.rowSpan}
                    colSpan={c.colSpan}
                    className="whitespace-pre-line border border-border bg-muted/40 px-2 py-2 font-semibold"
                  >
                    {c.text}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((raw, j) => {
                  const c = cell(raw);
                  return (
                    <td
                      key={j}
                      rowSpan={c.rowSpan}
                      colSpan={c.colSpan}
                      className="whitespace-pre-line border border-border px-2 py-2 text-center tabular-nums"
                    >
                      {c.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Иста табела са замењеним редовима и колонама — само за телефон. */
function TransposedTable({ table }: { table: DataTable }) {
  const head = table.head as string[];
  const rows = table.rows as string[][];
  return (
    <div className="mb-4 sm:hidden">
      <table className="w-full border-collapse text-sm">
        {table.caption ? (
          <caption className="border border-b-0 border-border px-3 py-2 font-semibold">
            {table.caption}
          </caption>
        ) : null}
        <thead>
          <tr>
            <th className="whitespace-pre-line border border-border bg-muted/40 px-2 py-2 font-semibold">
              {head[0]}
            </th>
            {rows.map((row, i) => (
              <th
                key={i}
                className="whitespace-pre-line border border-border bg-muted/40 px-2 py-2 font-semibold"
              >
                {row[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {head.slice(1).map((label, j) => (
            <tr key={j}>
              <th className="border border-border bg-muted/40 px-2 py-1.5 font-semibold">{label}</th>
              {rows.map((row, i) => (
                <td key={i} className="border border-border px-2 py-1.5 text-center tabular-nums">
                  {row[j + 1]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Обојена поља табеле као „ред-колона“, поређана да исти избор увек да исти стринг. */
const cellKey = (row: number, col: number) => `${row}-${col}`;
const byCell = (a: string, b: string) => {
  const [ar, ac] = a.split("-").map(Number);
  const [br, bc] = b.split("-").map(Number);
  return ar! - br! || ac! - bc!;
};
const parseCells = (answer: string) =>
  new Set(
    answer
      .split(",")
      .map((p) => p.trim())
      .filter((p) => /^\d+-\d+$/.test(p)),
  );

/**
 * Табела „обој кружић у одговарајућем пољу“. Боји се било који кружић, као на
 * папиру — у реду их може бити више или ниједан, а табела то не одаје.
 *
 * Цело поље је дугме, не само кружић: кружић од 18 пиксела је на телефону
 * премала мета, а поље табеле је бар 44 пиксела.
 *
 * На телефону табела од четири-пет колона не стане у ширину. Са бочним
 * скроловањем ученик лако не примети последњу колону, па би решавао задатак
 * без једног понуђеног одговора. Зато се испод 640 пиксела исти редови и исте
 * колоне слажу један испод другог: ред, па испод њега кружићи са називима
 * колона. Шта се боји и шта се шаље серверу остаје исто.
 */
function GridTable({
  rows,
  columns,
  columnImages,
  rowImages,
  answer,
  onChange,
  locked,
  correctCells,
}: {
  rows: string[];
  columns: string[];
  columnImages?: string[];
  rowImages?: string[];
  answer: string;
  onChange: (v: string) => void;
  locked: boolean;
  correctCells?: number[][];
}) {
  const chosen = parseCells(answer);
  const expected = new Set(
    (correctCells ?? []).flatMap((cols, row) => cols.map((col) => cellKey(row, col))),
  );

  const toggle = (key: string) => {
    const next = new Set(chosen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next].sort(byCell).join(","));
  };

  const rowLabel = (r: number) => (
    <>
      {rowImages?.[r] ? (
        <img
          src={imageUrl(rowImages[r]!)}
          alt={rows[r] || `Цртеж ${r + 1}`}
          className="h-16 w-auto max-w-[9rem] bg-white object-contain sm:h-20"
        />
      ) : null}
      {rows[r] ? <Rich text={rows[r]!} /> : null}
    </>
  );

  return (
    <>
      <div className="space-y-2 sm:hidden">
        {rows.map((row, r) => (
          <div key={r} className="rounded-lg border border-border px-3 py-2">
            <div className="mb-1 text-[15px] leading-snug">{rowLabel(r)}</div>
            <div className="flex flex-wrap gap-x-4">
              {columns.map((column, c) => {
                const key = cellKey(r, c);
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={locked}
                    onClick={() => toggle(key)}
                    aria-pressed={chosen.has(key)}
                    aria-label={`${row || `ред ${r + 1}`} — ${column || `колона ${c + 1}`}`}
                    className="flex min-h-11 min-w-11 items-center gap-2 text-left text-sm disabled:cursor-default"
                  >
                    <Circle state={circleState(chosen.has(key), expected.has(key), locked)} />
                    {columnImages?.[c] ? (
                      <img
                        src={imageUrl(columnImages[c]!)}
                        alt={column || `Цртеж ${c + 1}`}
                        className="h-10 w-auto max-w-[6.5rem] bg-white object-contain"
                      />
                    ) : null}
                    {column ? (
                      <span>
                        <Rich text={column} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="text-sm">
              <th className="border border-border px-2 py-2" />
              {columns.map((column, c) => (
                <th key={c} className="border border-border px-2 py-2 align-bottom font-medium">
                  {columnImages?.[c] ? (
                    <img
                      src={imageUrl(columnImages[c]!)}
                      alt={column || `Цртеж ${c + 1}`}
                      className="mx-auto h-14 w-auto max-w-[7.5rem] bg-white object-contain"
                    />
                  ) : null}
                  {column ? <Rich text={column} /> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <td className="border border-border px-3 py-2 leading-snug">{rowLabel(r)}</td>
                {columns.map((column, c) => {
                  const key = cellKey(r, c);
                  return (
                    <td key={c} className="border border-border p-0 text-center">
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => toggle(key)}
                        aria-pressed={chosen.has(key)}
                        aria-label={`${row || `ред ${r + 1}`} — ${column || `колона ${c + 1}`}`}
                        className="flex min-h-11 w-full min-w-11 items-center justify-center disabled:cursor-default"
                      >
                        <Circle state={circleState(chosen.has(key), expected.has(key), locked)} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Један део задатка. Избор у реченици („Србија / Шпанија“) задржава кружић
 * испод појма, као у збирци; остали избори стоје у списку испод захтева.
 */
function PartView({
  part,
  answer,
  onChange,
  locked,
  reveal,
}: {
  part: QuestionPart;
  answer: string;
  onChange: (v: string) => void;
  locked: boolean;
  reveal?: { correctAnswer: number } | { correctCells: number[][] };
}) {
  if (part.kind === "grid") {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-line text-[15px] leading-relaxed">
          {part.label ? <span className="mr-1 font-medium">{part.label}</span> : null}
          <Rich text={part.text} />
        </p>
        <GridTable
          rows={part.rows}
          columns={part.columns}
          columnImages={part.columnImages}
          rowImages={part.rowImages}
          answer={answer}
          onChange={onChange}
          locked={locked}
          correctCells={reveal && "correctCells" in reveal ? reveal.correctCells : undefined}
        />
      </div>
    );
  }

  const chosen = /^\d+$/.test(answer) ? Number(answer) : null;
  const correctIndex = reveal && "correctAnswer" in reveal ? reveal.correctAnswer : undefined;
  const state = (i: number) => circleState(chosen === i, correctIndex === i, locked);

  if (part.inline) {
    // Интерпункција одмах после избора („Шпанија.“) иде уз последњи појам,
    // као у књизи; сама би отишла у засебан ред кад се појмови преломе.
    const trailing = part.after?.match(/^[.,;:!?]+/)?.[0] ?? "";
    const rest = (part.after ?? "").slice(trailing.length).trim();
    const last = part.options.length - 1;
    return (
      <p className="text-[15px] leading-relaxed">
        {part.label ? <span className="mr-1 font-medium">{part.label}</span> : null}
        <Rich text={part.text} />{" "}
        {part.options.map((option, i) => (
          <Fragment key={i}>
            {i > 0 ? <span className="mx-1 align-top">/</span> : null}
            <button
              type="button"
              disabled={locked}
              onClick={() => onChange(String(i))}
              aria-pressed={chosen === i}
              className="inline-flex min-h-11 min-w-11 flex-col items-center align-top disabled:cursor-default"
            >
              <span>
                <Rich text={option} />
                {i === last ? trailing : null}
              </span>
              <Circle state={state(i)} size={16} />
            </button>
          </Fragment>
        ))}
        {rest ? (
          <>
            {" "}
            <Rich text={rest} />
          </>
        ) : null}
      </p>
    );
  }

  return (
    <div>
      <p className="mb-1.5 whitespace-pre-line text-[15px] leading-relaxed">
        {part.label ? <span className="mr-1 font-medium">{part.label}</span> : null}
        <Rich text={part.text} />
      </p>
      <ul>
        {part.options.map((option, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={locked}
              onClick={() => onChange(String(i))}
              aria-pressed={chosen === i}
              className="flex min-h-11 w-full items-center gap-3 py-1 text-left text-[15px] leading-relaxed disabled:cursor-default"
            >
              <Circle state={state(i)} />
              <span className="whitespace-pre-line">
                <Rich text={option} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Body({
  question,
  answer,
  selected,
  onChange,
  locked,
  reveal,
}: {
  question: Question;
  answer: string;
  selected: number[];
  onChange: (v: string) => void;
  locked: boolean;
  reveal?: Revealed;
}) {
  switch (question.type) {
    // ── Обој кружић испред тачног одговора ────────────────────────────────
    case "single":
    case "multi": {
      const multi = question.type === "multi";

      const toggle = (i: number, chosen: boolean) => {
        if (multi) {
          const next = chosen
            ? selected.filter((v) => v !== i)
            : [...selected, i].sort((a, b) => a - b);
          onChange(next.join(","));
        } else {
          onChange(String(i));
        }
      };

      // Понуђени одговори су слике — у збирци „обој кружић испод оног који…“.
      // Кружић иде испод слике, као у књизи.
      if (question.optionImages) {
        const images = question.optionImages;
        return (
          <div className="grid grid-cols-2 gap-4">
            {(question.options ?? []).map((label, i) => {
              const chosen = multi ? selected.includes(i) : selected[0] === i;
              const isCorrect = multi
                ? (reveal?.correctAnswers?.includes(i) ?? false)
                : reveal?.correctAnswer === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={locked}
                  onClick={() => toggle(i, chosen)}
                  aria-pressed={chosen}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-2 disabled:cursor-default ${
                    chosen && !locked ? "border-foreground" : "border-border"
                  }`}
                >
                  <img
                    src={imageUrl(images[i]!)}
                    alt={label || `Слика ${i + 1}`}
                    className="h-40 w-full rounded bg-white object-contain sm:h-52"
                  />
                  <span className="flex items-center gap-2 text-sm">
                    <Circle state={circleState(chosen, isCorrect, locked)} />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        );
      }

      return (
        <ul>
          {(question.options ?? []).map((option, i) => {
            const chosen = multi ? selected.includes(i) : selected[0] === i;
            const isCorrect = multi
              ? (reveal?.correctAnswers?.includes(i) ?? false)
              : reveal?.correctAnswer === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => toggle(i, chosen)}
                  aria-pressed={chosen}
                  className="flex min-h-11 w-full items-center gap-3 py-1 text-left text-[15px] leading-relaxed disabled:cursor-default"
                >
                  <Circle state={circleState(chosen, isCorrect, locked)} />
                  <span className="whitespace-pre-line">
                    <Rich text={option} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      );
    }

    // ── Допуни ────────────────────────────────────────────────────────────
    case "fill": {
      const parts = answer.split("|");
      return (
        <div className="space-y-3">
          {(question.fields ?? []).map((field, i) => (
            <label key={i} className="flex flex-wrap items-baseline gap-2">
              {/* Натпис који је већ питање („Која држава…?“) или редни број
                  („1.“) не добија још и двотачку. */}
              <span className="whitespace-pre-line text-[15px]">
                <Rich text={/[.:?]$/.test(field.label) ? field.label : `${field.label}:`} />
              </span>
              {/* 17 пиксела: испод тога iOS увећа страну при фокусу поља. */}
              <input
                type="text"
                disabled={locked}
                value={parts[i] ?? ""}
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  const next = [...parts];
                  while (next.length < (question.fields?.length ?? 0)) next.push("");
                  next[i] = e.target.value;
                  onChange(next.every((v) => v.trim() === "") ? "" : next.join("|"));
                }}
                className="min-h-11 min-w-[10rem] flex-1 border-0 border-b border-muted-foreground/60 bg-transparent px-1 py-1 text-[17px] outline-none focus:border-foreground disabled:opacity-70"
              />
            </label>
          ))}
        </div>
      );
    }

    // ── Повежи: табела са кружићима, у сваком реду један избор ────────────
    case "match": {
      const right = question.rightItems ?? [];
      const left = question.leftItems ?? [];

      // Табела се црта док год је збирка црта — најшира има шест колона.
      // Преко тога збирка прелази на листу, па и овде.
      if (right.length > 6) {
        return (
          <div className="space-y-2">
            {left.map((item, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="flex-1 whitespace-pre-line text-[15px] leading-relaxed">
                  <Rich text={item} />
                </span>
                <select
                  disabled={locked}
                  value={
                    selected[i] === undefined || Number.isNaN(selected[i]) || selected[i]! < 0
                      ? ""
                      : String(selected[i])
                  }
                  onChange={(e) => {
                    const next = [...selected];
                    while (next.length < left.length) next.push(-1);
                    next[i] = Number(e.target.value);
                    onChange(next.join(","));
                  }}
                  className={`min-h-11 rounded-lg border bg-background px-2 py-1.5 text-[17px] outline-none sm:w-72 ${
                    locked && reveal?.correctPairs
                      ? reveal.correctPairs[i] === selected[i]
                        ? "border-emerald-500"
                        : "border-rose-500"
                      : "border-border focus:border-foreground"
                  }`}
                >
                  <option value="">— изабери —</option>
                  {right.map((option, j) => (
                    <option key={j} value={j}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {question.extraRight ? (
              <p className="text-sm text-muted-foreground">
                Једна ставка из десне колоне је вишак.
              </p>
            ) : null}
          </div>
        );
      }

      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="text-sm">
                <th className="border border-border px-2 py-2 text-left font-medium" />
                {right.map((option, j) => (
                  <th key={j} className="border border-border px-2 py-2 font-medium">
                    <Rich text={option} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {left.map((item, i) => (
                <tr key={i}>
                  <td className="border border-border px-2 py-2 leading-snug sm:px-3">
                    <Rich text={item} />
                  </td>
                  {right.map((_, j) => {
                    const chosen = selected[i] === j;
                    const isCorrect = reveal?.correctPairs?.[i] === j;
                    return (
                      <td key={j} className="border border-border p-0 text-center">
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            const next = [...selected];
                            while (next.length < left.length) next.push(-1);
                            next[i] = j;
                            onChange(next.join(","));
                          }}
                          aria-pressed={chosen}
                          aria-label={right[j]}
                          className="flex min-h-11 w-full min-w-11 items-center justify-center disabled:cursor-default"
                        >
                          <Circle state={circleState(chosen, isCorrect, locked)} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {question.extraRight ? (
            <p className="mt-2 text-sm text-muted-foreground">Једна ставка је вишак.</p>
          ) : null}
        </div>
      );
    }

    // ── Обој кружић у одговарајућем пољу ──────────────────────────────────
    case "grid":
      return (
        <GridTable
          rows={question.rows ?? []}
          columns={question.columns ?? []}
          columnImages={question.columnImages}
          rowImages={question.rowImages}
          answer={answer}
          onChange={onChange}
          locked={locked}
          correctCells={reveal?.correctCells}
        />
      );

    // ── Поређај ───────────────────────────────────────────────────────────
    case "order": {
      const items = question.items ?? [];
      return (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <select
                disabled={locked}
                value={
                  selected[i] === undefined || Number.isNaN(selected[i]) || selected[i]! < 1
                    ? ""
                    : String(selected[i])
                }
                onChange={(e) => {
                  const next = [...selected];
                  while (next.length < items.length) next.push(-1);
                  next[i] = Number(e.target.value);
                  onChange(next.join(","));
                }}
                className={`min-h-11 w-16 rounded-md border bg-background px-2 py-1 text-center text-[17px] outline-none ${
                  locked && reveal?.correctOrder
                    ? reveal.correctOrder[i] === selected[i]
                      ? "border-emerald-500"
                      : "border-rose-500"
                    : "border-muted-foreground/60 focus:border-foreground"
                }`}
              >
                <option value="">—</option>
                {items.map((_, j) => (
                  <option key={j} value={j + 1}>
                    {j + 1}
                  </option>
                ))}
              </select>
              <span className="flex-1 whitespace-pre-line text-[15px] leading-relaxed">
                <Rich text={item} />
              </span>
            </div>
          ))}
        </div>
      );
    }

    // ── Тачно / нетачно ───────────────────────────────────────────────────
    case "tf": {
      const values = answer.split(",").map((v) => v.trim().toUpperCase());
      const trueLabel = question.trueLabel ?? "Тачно";
      const falseLabel = question.falseLabel ?? "Нетачно";
      const statements = question.statements ?? [];
      const choose = (i: number, flag: "T" | "N") => {
        const next = [...values];
        while (next.length < statements.length) next.push("");
        next[i] = flag;
        onChange(next.join(","));
      };
      const stateOf = (i: number, flag: "T" | "N") => {
        const expected = reveal?.correct?.[i];
        const isCorrect = expected !== undefined && (flag === "T") === expected;
        return circleState(values[i] === flag, isCorrect, locked);
      };

      // На телефону две колоне кружића оставе тврдњи мање од стотину пиксела,
      // па дуже речи („Општегеографске“) гурну табелу у страну. Тврдња зато
      // иде у свој ред, а испод ње два кружића са натписом колоне.
      return (
        <>
          <div className="space-y-2 sm:hidden">
            {statements.map((statement, i) => (
              <div key={i} className="rounded-lg border border-border px-3 py-2">
                <p className="text-[15px] leading-snug">
                  <Rich text={statement} />
                </p>
                <div className="flex flex-wrap gap-x-6">
                  {(["T", "N"] as const).map((flag) => (
                    <button
                      key={flag}
                      type="button"
                      disabled={locked}
                      onClick={() => choose(i, flag)}
                      aria-pressed={values[i] === flag}
                      className="flex min-h-11 items-center gap-2 text-sm disabled:cursor-default"
                    >
                      <Circle state={stateOf(i, flag)} />
                      {flag === "T" ? trueLabel : falseLabel}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr className="text-sm">
                  <th className="border border-border px-3 py-2 text-left font-medium">Тврдња</th>
                  <th className="w-28 border border-border px-1 py-2 font-medium">{trueLabel}</th>
                  <th className="w-28 border border-border px-1 py-2 font-medium">{falseLabel}</th>
                </tr>
              </thead>
              <tbody>
                {statements.map((statement, i) => (
                  <tr key={i}>
                    <td className="border border-border px-3 py-2 leading-snug">
                      <Rich text={statement} />
                    </td>
                    {(["T", "N"] as const).map((flag) => (
                      <td key={flag} className="border border-border p-0 text-center">
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => choose(i, flag)}
                          aria-pressed={values[i] === flag}
                          aria-label={flag === "T" ? trueLabel : falseLabel}
                          className="flex min-h-11 w-full items-center justify-center disabled:cursor-default"
                        >
                          <Circle state={stateOf(i, flag)} />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    // ── Подвуци / обој кружиће испод речи ─────────────────────────────────
    case "pick": {
      const tokens = question.tokens ?? [];
      // Реченице иду једна испод друге; речи теку у реду, као у књизи.
      const avg = tokens.length
        ? tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length
        : 0;
      const asLines = tokens.some((t) => t.length > 40) || avg > 15;

      return (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            Обој кружић испод дела текста који означаваш.
          </p>
          <div className={asLines ? "space-y-2" : "flex flex-wrap items-end gap-x-3 gap-y-3"}>
            {tokens.map((token, i) => {
              const chosen = selected.includes(i);
              const isCorrect = reveal?.correctTokens?.includes(i) ?? false;
              const state = circleState(chosen, isCorrect, locked);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    const next = chosen
                      ? selected.filter((v) => v !== i)
                      : [...selected, i].sort((a, b) => a - b);
                    onChange(next.join(","));
                  }}
                  aria-pressed={chosen}
                  className={`flex min-h-11 ${
                    asLines ? "w-full flex-row items-start gap-3" : "flex-col items-center gap-1"
                  } text-left disabled:cursor-default`}
                >
                  {asLines ? (
                    <span className="mt-[3px]">
                      <Circle state={state} />
                    </span>
                  ) : null}
                  <span
                    className={`text-[15px] leading-relaxed ${
                      chosen ? "underline decoration-2 underline-offset-4" : ""
                    }`}
                  >
                    {token}
                  </span>
                  {asLines ? null : <Circle state={state} size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // ── Задатак из више делова ────────────────────────────────────────────
    case "parts": {
      const parts = question.parts ?? [];
      const given = answer.split(";");
      const setPart = (i: number, value: string) => {
        const next = parts.map((_, j) => (j === i ? value : (given[j] ?? "")));
        // Ни један део без избора значи да ученик још није ништа одговорио.
        onChange(next.every((v) => v === "") ? "" : next.join(";"));
      };
      return (
        <div className="space-y-4">
          {parts.map((part, i) => (
            <PartView
              key={i}
              part={part}
              answer={given[i] ?? ""}
              onChange={(v) => setPart(i, v)}
              locked={locked}
              reveal={reveal?.correctParts?.[i]}
            />
          ))}
        </div>
      );
    }

    // ── Слободан одговор ──────────────────────────────────────────────────
    case "open":
      return (
        <textarea
          disabled={locked}
          value={answer}
          onChange={(e) => onChange(e.target.value)}
          rows={question.lines ?? 5}
          placeholder="Овде напиши свој одговор."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[17px] leading-relaxed outline-none focus:border-foreground disabled:opacity-70"
        />
      );

    default:
      return null;
  }
}

/** Задаци код којих се одговор бира кружићима, па им треба тумач боја. */
const CIRCLE_TYPES = new Set(["single", "multi", "match", "grid", "tf", "pick", "parts"]);

function Reveal({
  question,
  reveal,
  selfMark,
  onSelfMark,
}: {
  question: Question;
  reveal: Revealed;
  selfMark?: boolean | null;
  onSelfMark?: (correct: boolean) => void;
}) {
  return (
    <div className="mt-5 space-y-3 rounded-lg bg-muted/40 px-4 py-3 text-[15px] leading-relaxed">
      {CIRCLE_TYPES.has(question.type) ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Circle state="correct" size={12} /> тачно обојено
          </span>
          <span className="flex items-center gap-1.5">
            <Circle state="missed" size={12} /> требало је обојити
          </span>
          <span className="flex items-center gap-1.5">
            <Circle state="wrong" size={12} /> погрешно обојено
          </span>
        </p>
      ) : null}

      {question.type === "fill" && reveal.correctFields ? (
        <div>
          <p className="mb-1 text-sm font-medium text-muted-foreground">Тачан одговор</p>
          <ul className="list-inside list-disc">
            {reveal.correctFields.map((variants, i) => (
              <li key={i}>
                {question.fields?.[i]?.label ? (
                  <>
                    <Rich text={question.fields[i]!.label} />{" "}
                  </>
                ) : null}
                <strong>{variants[0]}</strong>
                {variants.length > 1 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    (признаје се и: {variants.slice(1).join(", ")})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {question.type === "open" ? (
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-sm font-medium text-emerald-400">Прихватљив одговор</p>
            <p className="whitespace-pre-line">{reveal.acceptable}</p>
          </div>
          {reveal.unacceptable ? (
            <div>
              <p className="mb-1 text-sm font-medium text-rose-400">Неприхватљив одговор</p>
              <p className="whitespace-pre-line">{reveal.unacceptable}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="mb-1 text-sm font-medium text-muted-foreground">Објашњење</p>
        <p className="whitespace-pre-line">{reveal.explanation}</p>
      </div>

      {/*
        Задатке слободног одговора сервер не бодује — не постоји начин да машина
        процени да ли је образложење прихватљиво. Уместо да остану без поена,
        ученик их сам оцењује поредећи свој одговор са моделом изнад.
      */}
      {!question.scored && onSelfMark ? (
        <div className="border-t border-border/60 pt-3">
          <p className="mb-2 text-sm text-muted-foreground">
            Упореди свој одговор са моделом и сам процени:
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => onSelfMark(true)}
              className="flex min-h-11 items-center gap-2 text-sm"
            >
              <Circle state={selfMark === true ? "correct" : "empty"} />
              Одговорио сам тачно
            </button>
            <button
              type="button"
              onClick={() => onSelfMark(false)}
              className="flex min-h-11 items-center gap-2 text-sm"
            >
              <Circle state={selfMark === false ? "wrong" : "empty"} />
              Нисам
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
