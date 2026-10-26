-- Supabase > SQL Editor (solo las descargas; es repetible)
create or replace function increment_download(p_game_key text)
returns void language sql security definer set search_path = public as $$
  insert into stats (game_key, stat_type, count)
  values (p_game_key, 'download', 1)
  on conflict (game_key) do update set count = stats.count + 1;
$$;
grant execute on function increment_download(text) to anon;
alter table stats enable row level security;
drop policy if exists "stats leer" on stats;
create policy "stats leer" on stats for select using (true);
