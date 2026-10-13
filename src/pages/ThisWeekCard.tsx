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

export default function ThisWeekCard({ rows, days, now }: { rows: any[]; days: any[]; now: Date }) {
  const mon = new Date(now);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const key = ymd(mon);
  const w = rows.find((r) => r.week_start === key) ?? rows.find((r) => r.week_start > key);
  if (!w) return null;
  const isCurrent = w.week_start === key;
  const today = ymd(now);
  const list = days
    .filter((d) => d.week_start === w.week_start)
    .sort((a, b) => String(a.day).localeCompare(String(b.day)));
  return (
    <Card className="mb-4 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{isCurrent ? "This week's plan" : "Up next"}</span>
          <span className="font-display text-base font-semibold text-white">Week {w.week_no} · {md(w.week_start)}</span>
          <Pill color={PHASE_COLOR[w.phase] ?? "#64748b"}>{w.phase}</Pill>
        </div>
        <span className="text-xs text-slate-500">
          {one(num(w.run_miles))} mi run · {num(w.bike_min)} min bike · {num(w.strength_min)} min strength
        </span>
      </div>
      {w.goal && <p className="mb-3 text-sm text-slate-300">{w.goal}</p>}
      <div className="space-y-1">
        {list.map((d) => (
          <div key={d.day} className={`flex gap-3 rounded-md px-2 py-1.5 text-sm ${d.day === today ? "bg-emerald-500/10" : ""}`}>
            <span className={`w-9 shrink-0 font-semibold ${d.day === today ? "text-emerald-300" : "text-slate-400"}`}>{d.dow}</span>
            <span className="min-w-0 text-slate-200">
              {d.critical ? "★ " : ""}{d.detail}
              {d.pace_target && d.day === today && <span className="mt-0.5 block text-xs text-slate-500">{d.pace_target}</span>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
