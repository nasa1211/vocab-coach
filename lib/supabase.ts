// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './env-config';

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

// 일반 클라이언트 (프론트엔드/일반 API용)
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      const config = getSupabaseConfig();
      _supabase = createClient(config.url, config.anonKey);
    }
    return (_supabase as SupabaseClient)[prop as keyof SupabaseClient];
  },
});

// 관리자 전용 클라이언트 (서비스 키 사용, 크론잡/서버용)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      const config = getSupabaseConfig();
      _supabaseAdmin = createClient(config.url, config.serviceKey);
    }
    return (_supabaseAdmin as SupabaseClient)[prop as keyof SupabaseClient];
  },
});