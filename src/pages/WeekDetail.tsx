import { useState } from "react";
import { Card, Pill } from "../ui";

const PHASE_COLOR: Record<string, string> = {
  Return: "#64748b", Build: "#a78bfa", Marathon: "#fb923c", Taper: "#34d399", Race: "#f43f5e",
};
const num = (x: unknown) => Number(x) || 0;
const one = (x: number) => String(Math.round(x * 10) / 10);
const md = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function WeekDetail({ rows, days, defaultWeek }: { rows: any[]; days: any[]; defaultWeek: string }) {
  const [i, setI] = useState(Math.max(0, rows.findIndex((r) => r.week_start === defaultWeek)));
  const w = rows[i];
  if (!w) return null;
  const list = days
    .filter((d) => d.week_start === w.week_start)
    .sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const sum = (k: string) => list.reduce((a, d) => a + num(d[k]), 0);
  const today = ymd(new Date());
  const btn = "rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 disabled:opacity-30";
  return (
    <Card className="mb-4 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-semibold text-white">Week {w.week_no} · {md(w.week_start)}</h2>
          <Pill color={PHASE_COLOR[w.phase] ?? "#64748b"}>{w.phase}</Pill>
        </div>
        <div className="flex items-center gap-2">
          <button className={btn} disabled={i === 0} onClick={() => setI(i - 1)}>‹ Prev</button>
          <select
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
          >
            {rows.map((r, k) => (
              <option key={r.week_start} value={k}>Wk {r.week_no} · {md(r.week_start)}</option>
            ))}
          </select>
          <button className={btn} disabled={i === rows.length - 1} onClick={() => setI(i + 1)}>Next ›</button>
        </div>
      </div>
      {!list.length ? (
        <div className="text-xs text-slate-500">No daily detail for this week yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Day</th>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 text-right font-medium">🏃 mi</th>
                <th className="py-2 pr-3 text-right font-medium">🚴 min</th>
                <th className="py-2 pr-3 text-right font-medium">💪 min</th>
                <th className="py-2 font-medium">Plan</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.day} className={`border-t border-slate-800/60 ${d.day === today ? "bg-emerald-500/10" : ""}`}>
                  <td className="py-2.5 pr-3 font-semibold text-slate-300">{d.dow}</td>
                  <td className="py-2.5 pr-3 text-slate-400">{md(d.day)}</td>
                  <td className="py-2.5 pr-3 text-right text-slate-300">{num(d.run_miles) ? one(num(d.run_miles)) : "–"}</td>
                  <td className="py-2.5 pr-3 text-right text-slate-300">{num(d.bike_min) || "–"}</td>
                  <td className="py-2.5 pr-3 text-right text-slate-300">{num(d.strength_min) || "–"}</td>
                  <td className="py-2.5 text-white">{d.detail}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-700 font-semibold">
                <td className="py-2.5 pr-3 text-emerald-400" colSpan={2}>Weekly total</td>
                <td className="py-2.5 pr-3 text-right text-white">{one(sum("run_miles"))}</td>
                <td className="py-2.5 pr-3 text-right text-white">{sum("bike_min") || "–"}</td>
                <td className="py-2.5 pr-3 text-right text-white">{sum("strength_min") || "–"}</td>
                <td className="py-2.5 text-slate-400">
                  {list.filter((d) => num(d.run_miles) > 0).length} run days
                  {w.long_run_miles != null ? ` · longest ${one(num(w.long_run_miles))} mi` : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
