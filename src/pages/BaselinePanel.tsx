import { useMemo, useState } from "react";
import { Card } from "../ui";

type Race = { id: number; name: string; race_date: string | null; finish_time_s: number | null };
type Pred = { date: string; time_5k_s: number | null; time_half_s: number | null; time_full_s: number | null };
type Vo2 = { date: string; vo2max: number | string | null };
type Row = { label: string; now: string; base: string; delta: string; good: boolean | null; ref: boolean };

const DAY_MS = 86_400_000;
const num = (x: unknown) => Number(x) || 0;
const parse = (s: string) => new Date(`${s}T00:00:00`);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const diffDays = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / DAY_MS);
const md = (s: string) => parse(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const mdy = (s: string) =>
  parse(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const mi = (a: any) => num(a.distance_m) / 1000;
const isRun = (a: any) => String(a.activity_type ?? "").includes("running") && mi(a) >= 1.5;
const paceS = (a: any) => num(a.duration_s) / mi(a);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((p, q) => p - q);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mmss = (sec: number) => {
  const t = Math.round(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const fmtPace = (s: number | null) => (s == null ? "–" : mmss(s));
const fmtTime = (sec: number) => {
  const t = Math.round(sec);
  const h = Math.floor(t / 3600);
  return `${h}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const nn = (x: unknown) => (x == null ? null : num(x));

function windowStats(acts: any[], end: string, days: number) {
  const start = addDays(end, -(days - 1));
  const runs = acts.filter((a) => isRun(a) && a.activity_date >= start && a.activity_date <= end);
  const miles = runs.reduce((s, a) => s + mi(a), 0);
  const longest = runs.reduce((m, a) => Math.max(m, mi(a)), 0);
  const banded = runs.filter((a) => num(a.avg_hr) >= 140 && num(a.avg_hr) <= 155 && mi(a) >= 3);
  return {
    perWeek: runs.length ? miles / (days / 7) : null,
    longest: runs.length ? longest : null,
    paceAtHr: median(banded.map(paceS)),
  };
}

function latest<T extends { date: string }>(rows: T[], on: string): T | null {
  let best: T | null = null;
  for (const r of rows) if (r.date <= on && (!best || r.date > best.date)) best = r;
  return best;
}

function runOn(acts: any[], date: string) {
  let best: any = null;
  for (const a of acts) if (a.activity_date === date && isRun(a) && (!best || mi(a) > mi(best))) best = a;
  return best;
}
const runText = (a: any) =>
  `${mi(a).toFixed(1)} mi · ${mmss(paceS(a))}/mi${num(a.avg_hr) ? ` · ${num(a.avg_hr)} bpm` : ""}`;

function mk(
  label: string, now: number | null, base: number | null,
  fmt: (x: number) => string, fmtD: (x: number) => string, lowerBetter: boolean, ref: boolean,
): Row {
  if (now == null || base == null) {
    return { label, now: now == null ? "–" : fmt(now), base: base == null ? "–" : fmt(base), delta: "–", good: null, ref };
  }
  const d = now - base;
  const good = Math.abs(d) < 1e-9 ? null : lowerBetter ? d < 0 : d > 0;
  return { label, now: fmt(now), base: fmt(base), delta: `${d > 0 ? "+" : d < 0 ? "−" : ""}${fmtD(Math.abs(d))}`, good, ref };
}

export default function BaselinePanel(props: {
  races: Race[]; vo2: Vo2[]; preds: Pred[]; activities: any[]; planDays: any[]; weeks: any[];
  goalDate: string | null; now: Date;
}) {
  const { races, vo2, preds, activities, planDays, weeks, goalDate, now } = props;
  const usable = races.filter((r) => r.race_date);
  const [raceId, setRaceId] = useState<number>(
    usable.find((r) => r.race_date === "2024-03-17")?.id ?? usable[0]?.id ?? 0,
  );
  const race = usable.find((r) => r.id === raceId) ?? null;
  const raceDate = race?.race_date ?? null;
  const today = iso(now);
  const mon = new Date(now);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const curKey = iso(mon);
  const blockWeeks = weeks
    .filter((w) => ["Marathon", "Taper", "Race"].includes(w.phase))
    .sort((a, b) => String(a.week_start).localeCompare(String(b.week_start)));
  const [selWeek, setSelWeek] = useState<string>(
    () => (blockWeeks.find((w) => w.week_start === curKey) ?? blockWeeks[0])?.week_start ?? "",
  );

  const snap = useMemo(() => {
    if (!raceDate || !goalDate) return null;
    const daysTo = diffDays(goalDate, today);
    const baseDate = addDays(raceDate, -daysTo);
    return {
      daysTo, baseDate,
      a4: windowStats(activities, today, 28), b4: windowStats(activities, baseDate, 28),
      a8: windowStats(activities, today, 56), b8: windowStats(activities, baseDate, 56),
      predNow: latest(preds, today), predBase: latest(preds, baseDate),
      vNow: latest(vo2, today), vBase: latest(vo2, baseDate),
      predEve: latest(preds, addDays(raceDate, -1)),
    };
  }, [activities, preds, vo2, raceDate, goalDate, today]);

  if (!race || !raceDate || !goalDate || !snap) return null;

  const miFmt = (x: number) => `${x.toFixed(1)} mi`;
  const rows: Row[] = [
    mk("Weekly mileage (4-wk avg)", snap.a4.perWeek, snap.b4.perWeek, miFmt, miFmt, false, false),
    mk("Longest run (4 wk)", snap.a4.longest, snap.b4.longest, miFmt, miFmt, false, false),
    mk("Pace at HR 140–155 (8 wk)", snap.a8.paceAtHr, snap.b8.paceAtHr, (x) => `${mmss(x)}/mi`, (x) => `${Math.round(x)} s/mi`, true, false),
    mk("Marathon prediction", nn(snap.predNow?.time_full_s), nn(snap.predBase?.time_full_s), fmtTime, mmss, true, true),
    mk("Half prediction", nn(snap.predNow?.time_half_s), nn(snap.predBase?.time_half_s), fmtTime, mmss, true, true),
    mk("5K prediction", nn(snap.predNow?.time_5k_s), nn(snap.predBase?.time_5k_s), mmss, mmss, true, true),
    mk("VO2 max", nn(snap.vNow?.vo2max), nn(snap.vBase?.vo2max), (x) => x.toFixed(1), (x) => x.toFixed(1), false, true),
  ];

  const eveFull = nn(snap.predEve?.time_full_s);
  const finish = race.finish_time_s;
  const calib =
    eveFull && finish
      ? `Garmin predicted ${fmtTime(eveFull)} the day before; you ran ${fmtTime(finish)} (${Math.abs(((finish - eveFull) / eveFull) * 100).toFixed(1)}% ${finish < eveFull ? "faster" : "slower"}).`
      : null;

  const dayRows = planDays
    .filter((d) => d.week_start === selWeek)
    .sort((x, y) => String(x.day).localeCompare(String(y.day)))
    .map((d) => {
      const bDate = addDays(raceDate, -diffDays(goalDate, d.day));
      return { d, bDate, act: d.day <= today ? runOn(activities, d.day) : null, base: runOn(activities, bDate) };
    });
  const blockStarted = blockWeeks.length > 0 && today >= blockWeeks[0].week_start;
  const selectCls = "rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300";

  return (
    <div>
      <Card className="mb-4 p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-white">Compared with the same point before {race.name}</h2>
          <select value={raceId} onChange={(e) => setRaceId(Number(e.target.value))} className={selectCls}>
            {usable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Today is {snap.daysTo} days before {md(goalDate)}. The matching day is {mdy(snap.baseDate)}, {snap.daysTo} days before {race.name}.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Metric</th>
                <th className="py-2 pr-3 text-right font-medium">Now</th>
                <th className="py-2 pr-3 text-right font-medium">Then</th>
                <th className="py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={`border-t border-slate-800/60 ${r.ref ? "opacity-70" : ""}`}>
                  <td className="py-2.5 pr-3 text-slate-300">{r.label}{r.ref ? " · ref" : ""}</td>
                  <td className="py-2.5 pr-3 text-right text-white">{r.now}</td>
                  <td className="py-2.5 pr-3 text-right text-slate-400">{r.base}</td>
                  <td className={`py-2.5 text-right font-semibold ${r.good == null ? "text-slate-500" : r.good ? "text-emerald-400" : "text-amber-400"}`}>{r.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {calib && <p className="mt-3 text-xs text-slate-400">{calib}</p>}
        <p className="mt-2 text-xs text-slate-600">
          Mileage and longest run use the trailing 4 weeks, pace at HR the trailing 8 weeks. Garmin predictions and VO2 max are reference only.
        </p>
      </Card>

      {blockWeeks.length > 0 && (
        <Card className="mb-4 p-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-white">Run by run vs {race.name}</h2>
            <select value={selWeek} onChange={(e) => setSelWeek(e.target.value)} className={selectCls}>
              {blockWeeks.map((w) => <option key={w.week_start} value={w.week_start}>Wk {w.week_no} · {md(w.week_start)}</option>)}
            </select>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            {blockStarted
              ? "Each day is matched to the same number of days before the race, and the same weekday."
              : `The marathon block starts ${md(blockWeeks[0].week_start)}. Until then this shows what you did at this point before ${race.name}.`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Day</th>
                  <th className="py-2 pr-3 font-medium">Plan</th>
                  <th className="py-2 pr-3 font-medium">This block</th>
                  <th className="py-2 pr-3 font-medium">Then</th>
                  <th className="py-2 text-right font-medium">Pace change</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map(({ d, bDate, act, base }) => {
                  let delta = "–";
                  let good: boolean | null = null;
                  if (act && base) {
                    if (Math.abs(mi(act) - mi(base)) <= 0.3 * Math.max(mi(act), mi(base))) {
                      const diff = paceS(act) - paceS(base);
                      delta = `${diff < 0 ? "−" : "+"}${Math.abs(Math.round(diff))} s/mi`;
                      good = diff < 0;
                    } else delta = "different length";
                  }
                  return (
                    <tr key={d.day} className={`border-t border-slate-800/60 ${d.day === today ? "bg-emerald-500/10" : ""}`}>
                      <td className="py-2.5 pr-3 text-slate-300"><span className="font-semibold">{d.dow}</span> {md(d.day)}</td>
                      <td className="py-2.5 pr-3 text-slate-300">{d.critical ? "★ " : ""}{num(d.run_miles) ? `${num(d.run_miles)} mi` : "–"}</td>
                      <td className="py-2.5 pr-3 text-white">{act ? runText(act) : d.day <= today ? "–" : "upcoming"}</td>
                      <td className="py-2.5 pr-3 text-slate-400">{base ? `${md(bDate)}: ${runText(base)}` : `${md(bDate)}: no run`}</td>
                      <td className={`py-2.5 text-right font-semibold ${good == null ? "text-slate-500" : good ? "text-emerald-400" : "text-amber-400"}`}>{delta}</td>
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
