-- Новые рамки (если shop.sql уже запускали): безопасно выполнять повторно
insert into public.shop_items (id, slot, price) values
  ('carbon', 'skin', 1500000),
  ('silver', 'skin', 2500000),
  ('bronze', 'skin', 2500000),
  ('gold', 'skin', 3000000),
  ('rose', 'skin', 4000000),
  ('emerald', 'skin', 5000000),
  ('ruby', 'skin', 5000000),
  ('sapphire', 'skin', 5000000),
  ('sunset', 'skin', 7000000),
  ('neon', 'skin', 8000000),
  ('midnight', 'skin', 9000000),
  ('aurora', 'skin', 12000000),
  ('hologram', 'skin', 15000000)
on conflict (id) do update set slot = excluded.slot, price = excluded.price;
