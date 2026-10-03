export function getKSTDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function getKSTMinutes(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  let hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

function slotStartMinutes(time: string): number | null {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

export function isSlotDue(time: string, date = new Date()): boolean {
  const start = slotStartMinutes(time);
  if (start == null) return false;
  return getKSTMinutes(date) >= start;
}

export function isSlotReleased(time: string, sent: boolean, date = new Date()): boolean {
  const start = slotStartMinutes(time);
  if (start == null) return false;
  const now = getKSTMinutes(date);
  if (now < start) return false;
  if (sent) return true;
  return now >= start + 60;
}

export function isAwaitingPush(time: string, sent: boolean, date = new Date()): boolean {
  return isSlotDue(time, date) && !isSlotReleased(time, sent, date);
}
