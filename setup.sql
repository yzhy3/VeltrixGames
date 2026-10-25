-- Ejecuta esto UNA vez en Supabase > SQL Editor (si ya lo hiciste, no pasa nada: es repetible)

-- Función que suma +1 a la fila del juego (la crea si no existe)
create or replace function increment_download(p_game_key text)
returns void language sql security definer set search_path = public as $$
  insert into stats (game_key, stat_type, count)
  values (p_game_key, 'download', 1)
  on conflict (game_key) do update set count = stats.count + 1;
$$;
grant execute on function increment_download(text) to anon;

-- Lectura pública de las descargas
alter table stats enable row level security;
drop policy if exists "stats leer" on stats;
create policy "stats leer" on stats for select using (true);
drop policy if exists "stats insertar" on stats;
