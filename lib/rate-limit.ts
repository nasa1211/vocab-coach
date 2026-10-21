/**
 * Simple in-memory rate limiter
 * NOTE: This is per-instance on Vercel serverless functions.
 * Each function instance maintains its own memory, so limits are approximate.
 * For strict enforcement, use Redis or similar distributed store.
 */

type LimitConfig = {
  requests: number;
  window: number; // milliseconds
};

type TokenBucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, TokenBucket>();

function cleanupOldBuckets() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > oneHour) {
      buckets.delete(key);
    }
  }
}

// Cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldBuckets, 5 * 60 * 1000);
}

export function rateLimit(identifier: string, config: LimitConfig): { success: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(identifier);

  if (!bucket) {
    buckets.set(identifier, {
      tokens: config.requests - 1,
      lastRefill: now,
    });
    return { success: true, remaining: config.requests - 1 };
  }

  // Calculate tokens to add based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refillRate = config.requests / config.window;
  const tokensToAdd = Math.floor(elapsed * refillRate);

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(config.requests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { success: true, remaining: bucket.tokens };
  }

  return { success: false, remaining: 0 };
}

export const AI_RATE_LIMIT = {
  requests: 10,
  window: 60 * 1000, // 10 requests per minute
};

export const WRITE_RATE_LIMIT = {
  requests: 30,
  window: 60 * 1000, // 30 requests per minute
};
