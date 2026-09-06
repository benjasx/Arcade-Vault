-- profiles: nombre de arcade por usuario
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 10),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- select público (los rankings muestran profiles.name)
create policy "profiles_select_public"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- update solo del propio perfil
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- crea el profile al registrarse: name de raw_user_meta_data, en mayúsculas y truncado a 10
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(
      upper(
        coalesce(
          nullif(new.raw_user_meta_data ->> 'name', ''),
          nullif(new.raw_user_meta_data ->> 'user_name', ''),
          nullif(new.raw_user_meta_data ->> 'full_name', ''),
          'PLAYER'
        )
      ),
      10
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
