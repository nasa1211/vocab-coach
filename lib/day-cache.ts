import { getKSTDateString } from "@/lib/kst";

type Envelope<T> = {
  date: string;
  data: T;
};

const memory = new Map<string, Envelope<unknown>>();
const pending = new Map<string, Promise<unknown>>();

function today() {
  return getKSTDateString();
}

export function readDayCache<T>(key: string): T | null {
  const date = today();
  const cached = memory.get(key);
  if (cached?.date === date) return cached.data as T;
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (parsed.date !== date || !("data" in parsed)) return null;
    memory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeDayCache<T>(key: string, data: T) {
  const envelope: Envelope<T> = { date: today(), data };
  memory.set(key, envelope);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // The in-memory copy still covers this visit.
  }
}

export function loadDayCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = readDayCache<T>(key);
  if (cached !== null) return Promise.resolve(cached);

  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;

  const request = load()
    .then((data) => {
      writeDayCache(key, data);
      pending.delete(key);
      return data;
    })
    .catch((error: unknown) => {
      pending.delete(key);
      throw error;
    });
  pending.set(key, request);
  return request;
}
