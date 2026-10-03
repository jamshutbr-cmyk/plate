# Сервер (Supabase): запуск

Нужны: аккаунт Supabase, Supabase CLI, токен бота от @BotFather.

1. Создать проект в Supabase. В **Authentication → Providers → Email** оставить email включённым, «Confirm email» можно выключить (функция сама подтверждает).
2. SQL Editor: выполнить `schema.sql`, затем `seed_regions.sql` (141 код регионов). Схема ни разу не запускалась на живой базе: если будут ошибки, пришлите текст.
3. Секреты функций:
   ```
   supabase secrets set BOT_TOKEN=<токен бота> PASSWORD_PEPPER=<длинная случайная строка, например openssl rand -hex 32>
   ```
   `PASSWORD_PEPPER` менять нельзя: от него зависят пароли всех игроков.
4. Деплой: `supabase functions deploy tg-auth` и `supabase functions deploy generate`.
   У `tg-auth` включить «verify JWT = off» (`--no-verify-jwt`): её зовут до входа.
5. В `_shared/cors.ts` заменить `*` на домен Mini App перед выходом в прод.

Логика: клиент шлёт `initData` в `tg-auth`, получает сессию (access/refresh token) и дальше зовёт `generate` и SQL-функции (`supabase.rpc`) с этим JWT. Баланс, цены и редкость считает только сервер.

Тесты `npm test` проверяют, что серверный движок даёт те же результаты, что клиентский, и что проверка подписи Telegram работает.
