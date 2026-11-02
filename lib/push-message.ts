export const PUSH_TITLE = "오늘의 영어 단어";
export const PUSH_FALLBACK_BODY = "오늘의 영어 단어를 확인해 보세요.";

type PushWord = { word?: string | null; meaning?: string | null };

function shortMeaning(meaning: string | null | undefined) {
  const first = (meaning ?? "").split(/[,;/]/)[0].trim();
  return first.length > 20 ? first.slice(0, 20).trim() : first;
}

// Plain text only (no emoji) so VoiceOver reads it cleanly.
export function buildDailyPushMessage(words: PushWord[] | null | undefined) {
  const parts = (words ?? [])
    .filter((item) => item?.word?.trim())
    .map((item) => {
      const word = item.word!.trim();
      const meaning = shortMeaning(item.meaning);
      return meaning ? `${word}, ${meaning}.` : `${word}.`;
    });
  if (parts.length === 0) return { title: PUSH_TITLE, body: PUSH_FALLBACK_BODY };
  return { title: PUSH_TITLE, body: `오늘의 단어: ${parts.join(" ")}` };
}

export type PushResult = { host: string; statusCode: number };

export function pushHost(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return "unknown";
  }
}

export type PushSummary = {
  date: string;
  slot: number;
  sent: number;
  failed: number;
  results: PushResult[];
  at: string;
};

export function buildPushSummary(
  date: string,
  slot: number,
  results: PushResult[],
  sent: number,
  failed: number,
  at = new Date().toISOString()
): PushSummary {
  return { date, slot, sent, failed, results: results.slice(0, 20), at };
}

export function parsePushSummary(value: unknown): PushSummary | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<PushSummary>;
  if (typeof v.date !== "string" || typeof v.slot !== "number") return null;
  return {
    date: v.date,
    slot: v.slot,
    sent: Number(v.sent) || 0,
    failed: Number(v.failed) || 0,
    at: typeof v.at === "string" ? v.at : "",
    results: Array.isArray(v.results)
      ? v.results
          .filter((r) => r && typeof r.host === "string")
          .slice(0, 20)
          .map((r) => ({ host: String(r.host), statusCode: Number(r.statusCode) || 0 }))
      : [],
  };
}
