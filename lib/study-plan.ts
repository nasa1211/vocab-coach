export const STATE_WORD = "__app_state__";

export const DAILY_SLOTS = [
  { slot: 1, label: "아침", time: "08:00" },
  { slot: 2, label: "낮", time: "13:00" },
  { slot: 3, label: "저녁", time: "18:00" },
] as const;

type OrderedWord = {
  id: string;
  created_at: string;
};

function mod(value: number, length: number) {
  return ((value % length) + length) % length;
}

export function pickDailyWords<T extends OrderedWord>(words: T[], studyDate: string, count = 3): T[] {
  const sorted = [...words].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  );
  if (sorted.length === 0) return [];

  const day = Math.floor(Date.parse(`${studyDate}T00:00:00Z`) / 86_400_000);
  const start = mod(day * count, sorted.length);
  const size = Math.min(count, sorted.length);

  return Array.from({ length: size }, (_, index) => sorted[(start + index) % sorted.length]);
}
