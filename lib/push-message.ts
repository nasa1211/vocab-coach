export type PushResult = { host: string; statusCode: number };

/** RFC 8030 Topic: ^[A-Za-z0-9_-]{1,32}$ */
export function pushTopic(date: string, slot: number) {
  return `vocab-${date}-s${slot}`;
}

export function pushTag(date: string, slot: number) {
  return `vocab-${date}-slot-${slot}`;
}

export function pushSendOptions(topic: string) {
  return { urgency: "high" as const, topic };
}

export function topicFromPushUrl(url: string) {
  try {
    const u = new URL(url, "https://app.local");
    const date = u.searchParams.get("date");
    const slot = Number(u.searchParams.get("slot") || "");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && [1, 2, 3].includes(slot)) {
      return pushTopic(date, slot);
    }
  } catch {
    /* invalid url */
  }
  return "vocab-manual-send";
}

export function buildCronPushPayload(
  word: string,
  body: string,
  url: string,
  date: string,
  slot: number
) {
  const tag = pushTag(date, slot);
  return JSON.stringify({
    title: word,
    body,
    tag,
    data: { url, tag },
  });
}

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
