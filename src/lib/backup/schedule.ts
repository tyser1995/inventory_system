import type { AppConfig } from "../config";

type Schedule = AppConfig["backup"]["schedule"];

const HOUR = 3_600_000;
const PERIOD: Record<Schedule["frequency"], number> = {
  hourly: HOUR, "6h": 6 * HOUR, "12h": 12 * HOUR, daily: 24 * HOUR, weekly: 7 * 24 * HOUR,
};

/** Reference slot: today at HH:MM (moved to the configured weekday for weekly schedules). */
function anchor(now: Date, s: Schedule) {
  const [h, m] = s.time.split(":").map(Number);
  const a = new Date(now);
  a.setHours(s.frequency === "hourly" ? now.getHours() : h || 0, m || 0, 0, 0);
  if (s.frequency === "weekly") a.setDate(a.getDate() + (s.weekday - a.getDay()));
  return a.getTime();
}

/** Most recent scheduled slot at or before `now`. */
export function previousSlot(now: Date, s: Schedule) {
  const a = anchor(now, s);
  const p = PERIOD[s.frequency];
  return a + Math.floor((now.getTime() - a) / p) * p;
}

export function nextSlot(now: Date, s: Schedule) {
  return previousSlot(now, s) + PERIOD[s.frequency];
}
