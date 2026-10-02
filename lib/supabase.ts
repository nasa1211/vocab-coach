// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 일반 클라이언트 (프론트엔드/일반 API용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 관리자 전용 클라이언트 (서비스 키 사용, 크론잡/서버용)
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
);