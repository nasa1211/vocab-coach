create table if not exists public.word_progress (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  word text not null,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  stage int not null default 0,
  last_seen_at timestamptz,
  next_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_key, word)
);

create index if not exists word_progress_due_idx on public.word_progress (user_key, next_due_at);

alter table public.word_progress enable row level security;

create table if not exists public.daily_sets (
  user_key text not null,
  study_date date not null,
  words jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_key, study_date)
);

alter table public.daily_sets enable row level security;
