import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyServerSecret, getClientIp, getDeviceIdFromHeader } from '../lib/api-auth';
import { NextRequest } from 'next/server';

describe('api-auth', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('verifyServerSecret', () => {
    it('should return true with valid PUSH_SEND_SECRET', () => {
      vi.stubEnv('PUSH_SEND_SECRET', 'my-secret');
      const req = new NextRequest('http://localhost/api/test', {
        headers: { authorization: 'Bearer my-secret' },
      });
      expect(verifyServerSecret(req)).toBe(true);
    });

    it('should return true with valid CRON_SECRET fallback', () => {
      vi.stubEnv('CRON_SECRET', 'cron-secret');
      const req = new NextRequest('http://localhost/api/test', {
        headers: { authorization: 'Bearer cron-secret' },
      });
      expect(verifyServerSecret(req)).toBe(true);
    });

    it('should return false with invalid secret', () => {
      vi.stubEnv('PUSH_SEND_SECRET', 'correct-secret');
      const req = new NextRequest('http://localhost/api/test', {
        headers: { authorization: 'Bearer wrong-secret' },
      });
      expect(verifyServerSecret(req)).toBe(false);
    });

    it('should return false when no secret is configured', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: { authorization: 'Bearer any-secret' },
      });
      expect(verifyServerSecret(req)).toBe(false);
    });
  });

  describe('getClientIp', () => {
    it('should extract IP from x-forwarded-for', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      });
      expect(getClientIp(req)).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-real-ip': '203.0.113.1' },
      });
      expect(getClientIp(req)).toBe('203.0.113.1');
    });

    it('should return "unknown" when no IP headers present', () => {
      const req = new NextRequest('http://localhost/api/test');
      expect(getClientIp(req)).toBe('unknown');
    });
  });

  describe('getDeviceIdFromHeader', () => {
    it('should return valid UUID device ID', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-device-id': validUuid },
      });
      expect(getDeviceIdFromHeader(req)).toBe(validUuid);
    });

    it('should return null for invalid UUID format', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-device-id': 'not-a-uuid' },
      });
      expect(getDeviceIdFromHeader(req)).toBeNull();
    });

    it('should return null when header is missing', () => {
      const req = new NextRequest('http://localhost/api/test');
      expect(getDeviceIdFromHeader(req)).toBeNull();
    });

    it('should accept UUID in any case', () => {
      const mixedCaseUuid = '550E8400-E29B-41D4-A716-446655440000';
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-device-id': mixedCaseUuid },
      });
      // Note: getDeviceIdFromHeader currently doesn't lowercase
      expect(getDeviceIdFromHeader(req)).not.toBeNull();
    });
  });
});
