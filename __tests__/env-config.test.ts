import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSupabaseConfig, getVapidConfig, getGeminiApiKey, _resetConfigs } from '../lib/env-config';

describe('env-config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    _resetConfigs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetConfigs();
  });

  describe('getSupabaseConfig', () => {
    it('should return config when all env vars are set', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');

      const config = getSupabaseConfig();
      expect(config).toEqual({
        url: 'https://test.supabase.co',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
    });

    it('should throw when URL is missing', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');

      expect(() => getSupabaseConfig()).toThrow(/Supabase configuration is incomplete/);
    });

    it('should throw when service key is missing', () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');

      expect(() => getSupabaseConfig()).toThrow(/SUPABASE_SERVICE_ROLE_KEY is required/);
    });
  });

  describe('getVapidConfig', () => {
    it('should return config when all VAPID vars are set', () => {
      vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'public-key');
      vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key');
      vi.stubEnv('VAPID_EMAIL', 'test@example.com');

      const config = getVapidConfig();
      expect(config).toEqual({
        publicKey: 'public-key',
        privateKey: 'private-key',
        email: 'test@example.com',
      });
    });

    it('should throw when VAPID email is missing', () => {
      vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'public-key');
      vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key');

      expect(() => getVapidConfig()).toThrow(/VAPID configuration is incomplete/);
    });
  });

  describe('getGeminiApiKey', () => {
    it('should return key when GEMINI_API_KEY is set', () => {
      vi.stubEnv('GEMINI_API_KEY', 'test-api-key');
      expect(getGeminiApiKey()).toBe('test-api-key');
    });

    it('should throw when GEMINI_API_KEY is missing', () => {
      expect(() => getGeminiApiKey()).toThrow(/GEMINI_API_KEY environment variable is required/);
    });
  });
});
