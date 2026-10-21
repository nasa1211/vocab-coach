import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSupabaseConfig, getVapidConfig, getGeminiApiKey, _resetConfigs } from '../lib/env-config';

describe('env-config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset module cache and config state
    _resetConfigs();
    // Create a clean env object
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    _resetConfigs();
  });

  describe('getSupabaseConfig', () => {
    it('should return config when all env vars are set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

      const config = getSupabaseConfig();
      expect(config).toEqual({
        url: 'https://test.supabase.co',
        anonKey: 'anon-key',
        serviceKey: 'service-key',
      });
    });

    it('should throw when URL is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      expect(() => getSupabaseConfig()).toThrow(/Supabase configuration is incomplete/);
    });

    it('should throw when service key is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      expect(() => getSupabaseConfig()).toThrow(/SUPABASE_SERVICE_ROLE_KEY is required/);
    });
  });

  describe('getVapidConfig', () => {
    it('should return config when all VAPID vars are set', () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public-key';
      process.env.VAPID_PRIVATE_KEY = 'private-key';
      process.env.VAPID_EMAIL = 'test@example.com';

      const config = getVapidConfig();
      expect(config).toEqual({
        publicKey: 'public-key',
        privateKey: 'private-key',
        email: 'test@example.com',
      });
    });

    it('should throw when VAPID email is missing', () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'public-key';
      process.env.VAPID_PRIVATE_KEY = 'private-key';
      delete process.env.VAPID_EMAIL;

      expect(() => getVapidConfig()).toThrow(/VAPID configuration is incomplete/);
    });
  });

  describe('getGeminiApiKey', () => {
    it('should return key when GEMINI_API_KEY is set', () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      expect(getGeminiApiKey()).toBe('test-api-key');
    });

    it('should throw when GEMINI_API_KEY is missing', () => {
      delete process.env.GEMINI_API_KEY;
      expect(() => getGeminiApiKey()).toThrow(/GEMINI_API_KEY environment variable is required/);
    });
  });
});
