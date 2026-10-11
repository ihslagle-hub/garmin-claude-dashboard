import { useMemo } from "react";
import type { Bundle } from "../lib/data";
import { ACTIVITY_BUCKETS, BUCKET_META, fmtKm } from "../lib/metrics";
import { adherence, blankTarget, daysUntil, weekProgress, weekStart, type TrainingPlan as Plan } from "../lib/plan";
import { Card, EmptyHint, PageHeader, Pill } from "../ui";

type Row = {
  week_start: string; phase: string; week_no: number;
  run_sessions: number; run_miles: number; long_run_miles: number | null;
  bike_sessions: number; bike_min: number;
  strength_sessions: number; strength_min: number;
  key_session: string | null; strength_focus: string | null; notes: string | null;
};
type Meta = { goal_name: string | null; goal_date: string | null; focus: string | null };

const PHASE_COLOR: Record<string, string> = {
  Return: "#64748b", Build: "#a78bfa", Marathon: "#fb923c", Taper: "#34d399", Race: "#f43f5e",
};

const num = (x: unknown) => Number(x) || 0;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shortDate = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function planFromRow(r: Row, meta?: Meta): Plan {
  const targets = {} as Plan["targets"];
  for (const b of ACTIVITY_BUCKETS) targets[b] = blankTarget();
  targets.running = { enabled: num(r.run_sessions) > 0, sessionsPerWeek: num(r.run_sessions), distancePerWeekKm: num(r.run_miles), durationPerWeekMin: 0, stepsPerDay: 0 };
  targets.cycling = { enabled: num(r.bike_sessions) > 0, sessionsPerWeek: num(r.bike_sessions), distancePerWeekKm: 0, durationPerWeekMin: num(r.bike_min), stepsPerDay: 0 };
  targets.weights = { enabled: num(r.strength_sessions) > 0, sessionsPerWeek: num(r.strength_sessions), distancePerWeekKm: 0, durationPerWeekMin: num(r.strength_min), stepsPerDay: 0 };
  return { goalName: meta?.goal_name ?? "", goalDate: meta?.goal_date ?? "", focus: meta?.focus ?? "", targets, updatedAt: "db" };
}

export default function TrainingPlan({ data, now, refreshed }: { data: Bundle; now: Date; refreshed?: string }) {
  const rows = ((data as any).plan ?? []) as Row[];
  const meta = (((data as any).planMeta ?? []) as Meta[])[0];
  const wkKey = ymd(weekStart(now));
  const cur = rows.find((r) => r.week_start === wkKey);
  const next = rows.find((r) => r.week_start > wkKey);
  const shown = cur ?? next;
  const plan = useMemo(() => (shown ? planFromRow(shown, meta) : null), [shown, meta]);
  const adh = useMemo(
    () => (plan && cur ? adherence(plan, data.activities, data.daily, now).filter((r) => r.target.enabled) : []),
    [plan, cur, data, now],
  );
  const pace = Math.round(weekProgress(now) * 100);
  const dleft = meta?.goal_date ? daysUntil(meta.goal_date, now) : null;

  const subtitle = cur
    ? `Week ${cur.week_no} of ${rows.length} · ${cur.phase} · ${pace}% through the week`
    : next
      ? `Plan starts ${shortDate(next.week_start)}`
      : "No plan loaded";

  return (
    <div>
      <PageHeader title="Training Plan" icon="🎯" accent="#34d399" refreshed={refreshed} subtitle={subtitle} right={null} />

      {!rows.length && <EmptyHint>No plan found in your database yet.</EmptyHint>}

      {!!rows.length && (meta?.goal_name || dleft != null) && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Training for</div>
            <div className="font-display text-xl font-semibold text-white">{meta?.goal_name || "—"}</div>
            {meta?.focus && <div className="mt-1 text-sm text-slate-400">{meta.focus}</div>}
          </div>
          {dleft != null && (
            <div className="text-right">
              <div className="font-display text-3xl font-semibold text-emerald-400">{dleft >= 0 ? dleft : 0}</div>
              <div className="text-xs text-slate-500">days to {shortDate(meta!.goal_date!)}</div>
            </div>
          )}
        </Card>
      )}

      {shown && (
        <Card className="mb-4 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Pill color={PHASE_COLOR[shown.phase] ?? "#64748b"}>{shown.phase}</Pill>
            <span className="text-xs text-slate-500">{cur ? "This week" : "Up next"} · week of {shortDate(shown.week_start)}</span>
          </div>
          <div className="text-base font-semibold text-white">{shown.key_session}</div>
          {shown.long_run_miles != null && <div className="mt-1 text-sm text-slate-300">Longest run: {num(shown.long_run_miles)} mi</div>}
          {shown.strength_focus && <div className="mt-2 text-sm text-slate-400">💪 {shown.strength_focus}</div>}
          {shown.notes && <div className="mt-2 text-xs text-slate-500">{shown.notes}</div>}
        </Card>
      )}

      {!!adh.length && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {adh.map((r) => <AdherenceCard key={r.bucket} row={r} pace={pace} />)}
        </div>
      )}

      {!!rows.length && (
        <Card className="p-5">
          <h2 className="mb-1 font-display text-base font-semibold text-white">Full plan</h2>
          <p className="mb-4 text-xs text-slate-500">Return to running, then Hanson Advanced · targets in miles</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Wk</th>
                  <th className="py-2 pr-3 font-medium">Week of</th>
                  <th className="py-2 pr-3 font-medium">Phase</th>
                  <th className="py-2 pr-3 font-medium">🏃 Run</th>
                  <th className="py-2 pr-3 font-medium">Long</th>
                  <th className="py-2 pr-3 font-medium">🚴 Bike</th>
                  <th className="py-2 pr-3 font-medium">💪 Strength</th>
                  <th className="py-2 font-medium">Key session</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isNow = r.week_start === wkKey;
                  return (
                    <tr key={r.week_start} className={`border-t border-slate-800/60 ${isNow ? "bg-emerald-500/10" : ""}`}>
                      <td className={`py-2.5 pr-3 font-semibold ${isNow ? "text-emerald-400" : "text-slate-400"}`}>{r.week_no}</td>
                      <td className="py-2.5 pr-3 text-slate-300">{shortDate(r.week_start)}</td>
                      <td className="py-2.5 pr-3"><Pill color={PHASE_COLOR[r.phase] ?? "#64748b"}>{r.phase}</Pill></td>
                      <td className="py-2.5 pr-3 text-slate-300">{r.run_sessions} × · {num(r.run_miles)} mi</td>
                      <td className="py-2.5 pr-3 text-slate-300">{r.long_run_miles != null ? `${num(r.long_run_miles)} mi` : "–"}</td>
                      <td className="py-2.5 pr-3 text-slate-300">{r.bike_sessions ? `${r.bike_sessions} × · ${r.bike_min} min` : "–"}</td>
                      <td className="py-2.5 pr-3 text-slate-300">{r.strength_sessions} × · {r.strength_min} min</td>
                      <td className="py-2.5 text-white">{r.key_session}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function AdherenceCard({ row, pace }: { row: ReturnType<typeof adherence>[number]; pace: number }) {
  const m = BUCKET_META[row.bucket];
  const statusMeta = {
    ahead: { label: "Target hit", color: "#34d399" },
    ontrack: { label: "On track", color: "#38bdf8" },
    behind: { label: "Behind", color: "#fb923c" },
    none: { label: "—", color: "#64748b" },
  }[row.status];
  const t = row.target;
  const bars: { label: string; actual: string; target: string; ratio: number }[] = [];
  if (t.sessionsPerWeek > 0)
    bars.push({ label: "Sessions", actual: `${row.actualSessions}`, target: `${t.sessionsPerWeek}`, ratio: row.actualSessions / t.sessionsPerWeek });
  if (m.distance && t.distancePerWeekKm > 0)
    bars.push({ label: "Distance", actual: fmtKm(row.actualKm), target: `${t.distancePerWeekKm} mi`, ratio: row.actualKm / t.distancePerWeekKm });
  if (t.durationPerWeekMin > 0)
    bars.push({ label: "Time", actual: `${row.actualMin}`, target: `${t.durationPerWeekMin} min`, ratio: row.actualMin / t.durationPerWeekMin });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg text-xl" style={{ background: `${m.color}1a` }}>{m.icon}</span>
          <span className="font-display text-base font-semibold text-white">{m.label}</span>
        </div>
        <Pill color={statusMeta.color}>{statusMeta.label}</Pill>
      </div>
      <div className="space-y-3">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-slate-400">{b.label}</span>
              <span className="text-slate-300"><span className="font-semibold text-white">{b.actual}</span> / {b.target}</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="absolute top-0 z-10 h-2 w-px bg-slate-400/70" style={{ left: `${Math.min(100, pace)}%` }} />
              <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(100, Math.round(b.ratio * 100))}%`, background: m.color }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
