/**
 * Environment configuration with lazy validation
 */

type SupabaseConfig = {
  url: string;
  anonKey: string;
  serviceKey: string;
};

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  email: string;
};

let supabaseConfig: SupabaseConfig | null = null;
let vapidConfig: VapidConfig | null = null;

// Exported for testing
export function _resetConfigs() {
  supabaseConfig = null;
  vapidConfig = null;
}

export function getSupabaseConfig(): SupabaseConfig {
  if (supabaseConfig) return supabaseConfig;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase configuration is incomplete. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  // SUPABASE_SERVICE_ROLE_KEY is optional: fall back to the anon key, as before.
  supabaseConfig = { url, anonKey, serviceKey: serviceKey || anonKey };
  return supabaseConfig;
}

export function getVapidConfig(): VapidConfig {
  if (vapidConfig) return vapidConfig;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;

  if (!publicKey || !privateKey || !email) {
    throw new Error(
      "VAPID configuration is incomplete. Please set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_EMAIL environment variables."
    );
  }

  vapidConfig = { publicKey, privateKey, email };
  return vapidConfig;
}

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY environment variable is required.");
  }
  return key;
}
