import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function lookupWordsInDatabase(options: {
  word?: string;
  category?: string;
  excludeHistory?: string[];
}) {
  const { word, category, excludeHistory = [] } = options;
  const historyList = excludeHistory.filter(Boolean);

  let query = supabase.from("words").select("*");

  if (word) {
    query = query.ilike("word", word);
  } else {
    if (category) {
      query = query.ilike("category", category);
    }
    if (historyList.length > 0) {
      const formattedHistory = historyList.map((item) => `"${item.replace(/"/g, '""')}"`).join(",");
      query = query.not("word", "in", `(${formattedHistory})`);
    }
  }

  const { data: dbWords, error: dbError } = await query.limit(30);
  if (dbError || !dbWords || dbWords.length === 0) return null;
  return dbWords[Math.floor(Math.random() * dbWords.length)];
}
