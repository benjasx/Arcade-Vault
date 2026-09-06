-- handle_new_user solo se invoca desde el trigger; no debe ser RPC pública
revoke execute on function public.handle_new_user() from public, anon, authenticated;
