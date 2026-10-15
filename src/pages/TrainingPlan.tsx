import { useMemo, useState } from "react";
import type { Bundle } from "../lib/data";
import { ACTIVITY_BUCKETS, BUCKET_META, fmtKm } from "../lib/metrics";
import { adherence, blankTarget, daysUntil, weekProgress, weekStart, type TrainingPlan as Plan } from "../lib/plan";
import { Card, EmptyHint, PageHeader, Pill } from "../ui";

type Wk = {
  week_start: string; phase: string; week_no: number;
  run_sessions: number; run_miles: number; long_run_miles: number | null;
  bike_sessions: number; bike_min: number; strength_sessions: number; strength_min: number;
  key_session: string | null; strength_focus: string | null; notes: string | null;
  goal: string | null; reminders: string[] | null;
};
type Day = {
  day: string; week_start: string; dow: string;
  run_miles: number; bike_min: number; strength_min: number;
  detail: string | null; critical: boolean; callout: string | null; pace_target: string | null;
};
type Meta = {
  goal_name: string | null; goal_date: string | null; focus: string | null;
  goal_time: string | null; paces: Record<string, string> | null;
};
type Parts = { run: string | null; bike: string | null; strength: string | null };

const TAG_STYLE: Record<string, string> = {
  Return: "bg-slate-700/50 text-slate-300",
  Build: "bg-violet-500/15 text-violet-300",
  Marathon: "bg-orange-500/15 text-orange-300",
  Taper: "bg-emerald-500/15 text-emerald-300",
  Race: "bg-amber-400/20 text-amber-300",
};
const ROWS = [
  { key: "run", label: "Run", color: "#f87171" },
  { key: "bike", label: "Bike", color: "#fb923c" },
  { key: "strength", label: "Strength", color: "#a78bfa" },
] as const;
const ZONES: [string, string][] = [
  ["easy", "Easy"], ["long_runs", "Long run"], ["marathon_tempo", "Tempo / MP"],
  ["strength", "Strength reps"], ["speed", "Speed reps"],
];

const num = (x: unknown) => Number(x) || 0;
const one = (x: number) => String(Math.round(x * 10) / 10);
const md = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const weekLabel = (s: string) => {
  const e = new Date(`${s}T00:00:00`);
  e.setDate(e.getDate() + 6);
  return `${md(s)} – ${md(ymd(e))}`;
};

function planFromRow(r: Wk, meta?: Meta): Plan {
  const targets = {} as Plan["targets"];
  for (const b of ACTIVITY_BUCKETS) targets[b] = blankTarget();
  targets.running = { enabled: num(r.run_sessions) > 0, sessionsPerWeek: num(r.run_sessions), distancePerWeekKm: num(r.run_miles), durationPerWeekMin: 0, stepsPerDay: 0 };
  targets.cycling = { enabled: num(r.bike_sessions) > 0, sessionsPerWeek: num(r.bike_sessions), distancePerWeekKm: 0, durationPerWeekMin: num(r.bike_min), stepsPerDay: 0 };
  targets.weights = { enabled: num(r.strength_sessions) > 0, sessionsPerWeek: num(r.strength_sessions), distancePerWeekKm: 0, durationPerWeekMin: num(r.strength_min), stepsPerDay: 0 };
  return { goalName: meta?.goal_name ?? "", goalDate: meta?.goal_date ?? "", focus: meta?.focus ?? "", targets, updatedAt: "db" };
}

function splitDetail(detail: string | null): Parts {
  const out: Parts = { run: null, bike: null, strength: null };
  const parts = (detail ?? "").replace(" + bike", " · bike").split(" · ").map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    if (/^no running/i.test(p)) continue;
    if (/^(strength|light upper|mobility|\d+ min mobility)/i.test(p)) out.strength = out.strength ? `${out.strength} · ${p}` : p;
    else if (/^bike/i.test(p)) out.bike = p;
    else out.run = out.run ? `${out.run} · ${p}` : p;
  }
  return out;
}

function Cell({ label, color, text, sub, miles, critical, isToday }: {
  label: string; color: string; text: string | null; sub?: string | null;
  miles?: number; critical?: boolean; isToday: boolean;
}) {
  const edge = isToday ? "border-emerald-500/50 bg-emerald-500/[0.06]" : critical ? "border-amber-400/50" : "border-slate-800/70";
  if (!text) return <td className={`border p-2 align-top text-slate-700 ${edge}`}>—</td>;
  return (
    <td className={`border p-2 align-top ${edge}`} style={{ background: isToday ? undefined : `${color}0d` }}>
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
        {label}{critical ? " · ★ key" : ""}
      </span>
      {!!miles && <span className="block font-display text-sm font-semibold text-white">{one(miles)} mi</span>}
      <span className={`block text-[11.5px] leading-snug ${critical ? "font-semibold text-slate-100" : "text-slate-400"}`}>{text}</span>
      {sub && <span className="mt-1 block text-[10.5px] leading-snug text-slate-500">{sub}</span>}
    </td>
  );
}

function WeekCard({ wk, days, isCurrent, today, open, onToggle }: {
  wk: Wk; days: Day[]; isCurrent: boolean; today: string; open: boolean; onToggle: () => void;
}) {
  const list = days.filter((d) => d.week_start === wk.week_start).sort((a, b) => a.day.localeCompare(b.day));
  const parsed = list.map((d) => ({ d, p: splitDetail(d.detail) }));
  const keyDays = list.filter((d) => d.critical && d.callout);
  return (
    <Card className={`mb-3 overflow-hidden ${isCurrent ? "border-emerald-500/40" : ""}`}>
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/30 px-5 py-3 text-left">
        <span className="font-display text-base font-semibold text-white">Week {wk.week_no}</span>
        <span className="text-xs tabular-nums text-slate-500">{weekLabel(wk.week_start)}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TAG_STYLE[wk.phase] ?? "bg-slate-700/50 text-slate-300"}`}>{wk.phase}</span>
        {isCurrent && (
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">This week</span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-[11px] font-medium text-slate-500">{one(num(wk.run_miles))} mi · {num(wk.run_sessions)} runs</span>
          <span className={`text-slate-600 transition ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>

      {open && (
        <div className="px-5 py-4">
          {!parsed.length ? (
            <div className="text-xs text-slate-500">No daily detail for this week yet.</div>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[860px] table-fixed border-collapse">
                <thead>
                  <tr>
                    <th className="w-16 p-1.5" />
                    {parsed.map(({ d }) => (
                      <th key={d.day} className={`p-1.5 text-center text-[10px] font-bold uppercase tracking-wider ${d.day === today ? "text-emerald-300" : "text-slate-500"}`}>
                        {d.dow}<span className="block font-medium normal-case tracking-normal">{md(d.day)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.key}>
                      <th className="p-1.5 text-left align-middle text-[11px] font-bold text-slate-300">{r.label}</th>
                      {parsed.map(({ d, p }) => {
                        const text = p[r.key];
                        return (
                          <Cell
                            key={d.day + r.key}
                            label={r.label}
                            color={r.color}
                            text={text}
                            miles={r.key === "run" && text ? num(d.run_miles) : undefined}
                            sub={r.key === "run" && text && d.pace_target ? d.pace_target.split(". ")[0] : null}
                            critical={r.key === "run" && d.critical}
                            isToday={d.day === today}
                          />
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 text-xs text-slate-500">
            Totals: run {one(num(wk.run_miles))} mi{wk.long_run_miles != null ? ` (longest ${one(num(wk.long_run_miles))} mi)` : ""} · bike {num(wk.bike_min)} min · strength {num(wk.strength_min)} min
          </div>

          {keyDays.map((d) => (
            <div key={d.day} className="mt-3 rounded-lg border-l-2 border-amber-400 bg-amber-400/[0.07] px-3.5 py-2.5 text-[13px] text-slate-300">
              <span className="font-semibold text-amber-300">{d.dow} {md(d.day)} · key session — </span>
              {d.callout}
              {d.pace_target && <div className="mt-1 text-xs text-slate-400">Pace: {d.pace_target}</div>}
            </div>
          ))}

          {wk.strength_focus && (
            <div className="mt-3 rounded-lg border-l-2 border-sky-400 bg-sky-400/[0.07] px-3.5 py-2.5 text-[13px] text-slate-300">
              <span className="font-semibold text-sky-300">Strength this week — </span>
              {wk.strength_focus}
            </div>
          )}

          {wk.goal && (
            <div className="mt-3 rounded-lg border-l-2 border-violet-400 bg-violet-400/[0.07] px-3.5 py-2.5">
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">Goal this week</div>
              <p className="text-[13px] leading-snug text-slate-300">{wk.goal}</p>
            </div>
          )}

          {!!wk.reminders?.length && (
            <div className="mt-3 rounded-lg border-l-2 border-emerald-400 bg-emerald-400/[0.07] px-3.5 py-2.5">
              <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Reminders</div>
              <ul className="list-disc space-y-0.5 pl-5 text-[13px] leading-snug text-slate-300">
                {wk.reminders.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}

          {wk.notes && <div className="mt-3 text-xs text-slate-500">{wk.notes}</div>}
        </div>
      )}
    </Card>
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

export default function TrainingPlan({ data, refreshed }: { data: Bundle; now?: Date; refreshed?: string }) {
  const now = new Date();
  const rows = ((data as any).plan ?? []) as Wk[];
  const days = ((data as any).planDays ?? []) as Day[];
  const meta = (((data as any).planMeta ?? []) as Meta[])[0];
  const wkKey = ymd(weekStart(now));
  const cur = rows.find((r) => r.week_start === wkKey);
  const next = rows.find((r) => r.week_start > wkKey);
  const shown = cur ?? next;
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => toggled[k] ?? k === shown?.week_start;
  const setAll = (v: boolean) => setToggled(Object.fromEntries(rows.map((r) => [r.week_start, v])));

  const plan = useMemo(() => (shown ? planFromRow(shown, meta) : null), [shown, meta]);
  const adh = useMemo(
    () => (plan && cur ? adherence(plan, data.activities, data.daily, now).filter((r) => r.target.enabled) : []),
    [plan, cur, data, now],
  );
  const pace = Math.round(weekProgress(now) * 100);
  const dleft = meta?.goal_date ? daysUntil(meta.goal_date, now) : null;
  const paces = meta?.paces ?? null;
  const subtitle = cur
    ? `Week ${cur.week_no} of ${rows.length} · ${cur.phase} · ${pace}% through the week`
    : next ? `Plan starts ${md(next.week_start)}` : "No plan loaded";

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
            {meta?.goal_time && <div className="mt-1 text-sm text-slate-300">Goal time {meta.goal_time} (provisional)</div>}
          </div>
          {dleft != null && meta?.goal_date && (
            <div className="text-right">
              <div className="font-display text-3xl font-semibold text-emerald-400">{dleft >= 0 ? dleft : 0}</div>
              <div className="text-xs text-slate-500">days to {md(meta.goal_date)}</div>
            </div>
          )}
        </Card>
      )}

      {paces && (
        <Card className="mb-4 p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-white">Pace guide</h2>
            <span className="text-xs text-slate-500">{paces.goal}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {ZONES.map(([k, label]) =>
              paces[k] ? (
                <div key={k}>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="font-display text-lg font-semibold text-white">{paces[k]}<span className="text-xs text-slate-500"> /mi</span></div>
                </div>
              ) : null,
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">{paces.review}. Return-to-running paces: {paces.phase1_easy}.</p>
        </Card>
      )}

      {!!adh.length && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {adh.map((r) => <AdherenceCard key={r.bucket} row={r} pace={pace} />)}
        </div>
      )}

      {!!rows.length && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">Weekly plan</h2>
            <div className="flex gap-2">
              <button onClick={() => setAll(true)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300">Expand all</button>
              <button onClick={() => setAll(false)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300">Collapse all</button>
            </div>
          </div>
          {rows.map((wk) => (
            <WeekCard
              key={wk.week_start}
              wk={wk}
              days={days}
              isCurrent={wk.week_start === wkKey}
              today={ymd(now)}
              open={isOpen(wk.week_start)}
              onToggle={() => setToggled((t) => ({ ...t, [wk.week_start]: !isOpen(wk.week_start) }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
