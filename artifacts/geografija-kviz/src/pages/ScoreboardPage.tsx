import { useEffect, useState } from "react";
import { api, blockLabel, type ScoreboardEntry } from "@/lib/api";

// Целине се овде наводе само као филтер; које целине постоје и колико имају
// задатака зна сервер (`/catalog`). Кључ непознат серверу враћа све резултате.
const BLOCKS = ["121-140", "141-160", "161-180", "181-200", "201-220", "221-240"];

export default function ScoreboardPage() {
  const [block, setBlock] = useState("");
  const [rows, setRows] = useState<ScoreboardEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = block ? `?block=${encodeURIComponent(block)}` : "";
    api<ScoreboardEntry[]>(`/scoreboard${query}`)
      .then(setRows)
      .catch((err: Error) => setError(err.message));
  }, [block]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Ранг-листа</h1>
        <p className="mt-1 text-muted-foreground">
          Приказује се само вежбање из збирке. Тестови са завршних испита имају
          другачије бодовање, па се не мешају у исти просек.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          value={block}
          onChange={(e) => setBlock(e.target.value)}
          className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-[17px] outline-none focus:border-primary sm:text-sm"
        >
          <option value="">Све целине</option>
          {BLOCKS.map((key) => (
            <option key={key} value={key}>
              {blockLabel(key)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3">{error}</p>
      ) : null}

      {/* На телефону се виде место, име и најбољи резултат; број покушаја и
          последњи резултат стају тек на ширем екрану. Табела се тако не
          скролује у страну, а оно по чему је ранг-листа поређана остаје. */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left font-medium sm:px-4">#</th>
              <th className="px-3 py-3 text-left font-medium sm:px-4">Ученик</th>
              <th className="px-3 py-3 text-right font-medium sm:px-4">Најбоље</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Покушаја</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Последње</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.username} className="border-t border-border">
                <td className="px-3 py-3 sm:px-4">{row.rank}</td>
                <td className="px-3 py-3 sm:px-4">{row.fullName}</td>
                <td className="px-3 py-3 text-right font-semibold sm:px-4">{row.bestScore}%</td>
                <td className="hidden px-4 py-3 text-right sm:table-cell">{row.attemptsCount}</td>
                <td className="hidden px-4 py-3 text-right sm:table-cell">
                  {row.lastScore === null ? "—" : `${row.lastScore}%`}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Нема резултата за изабрани филтер.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
