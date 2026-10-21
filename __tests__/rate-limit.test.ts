import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, AI_RATE_LIMIT, WRITE_RATE_LIMIT } from '../lib/rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    // Note: Can't easily reset the module-level Map in tests
    // Each test uses different identifiers to avoid interference
  });

  it('should allow requests within limit', () => {
    const identifier = 'test-user-1';
    const result = rateLimit(identifier, { requests: 5, window: 60000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should reject requests exceeding limit', () => {
    const identifier = 'test-user-2';
    const config = { requests: 2, window: 60000 };

    const first = rateLimit(identifier, config);
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(1);

    const second = rateLimit(identifier, config);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(0);

    const third = rateLimit(identifier, config);
    expect(third.success).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('should export AI and WRITE rate limit configs', () => {
    expect(AI_RATE_LIMIT).toEqual({
      requests: 10,
      window: 60 * 1000,
    });

    expect(WRITE_RATE_LIMIT).toEqual({
      requests: 30,
      window: 60 * 1000,
    });
  });

  it('should allow requests for different identifiers independently', () => {
    const config = { requests: 1, window: 60000 };

    const user1 = rateLimit('user-a', config);
    expect(user1.success).toBe(true);

    const user2 = rateLimit('user-b', config);
    expect(user2.success).toBe(true);
  });
});
