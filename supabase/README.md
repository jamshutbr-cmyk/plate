# Сервер (Supabase): запуск

Нужны: аккаунт Supabase, Supabase CLI, токен бота от @BotFather.

1. Создать проект в Supabase. В **Authentication → Providers → Email** оставить email включённым, «Confirm email» можно выключить (функция сама подтверждает).
2. SQL Editor: выполнить `schema.sql`, затем `seed_regions.sql` (141 код регионов), затем `shop.sql` (магазин: рамки, титулы, эффекты, платный регион, свой номер; он же закрывает права на служебные функции `commit_plate_fee` и `commit_custom_plate`). Схема ни разу не запускалась на живой базе: если будут ошибки, пришлите текст.
3. Секреты функций:
   ```
   supabase secrets set BOT_TOKEN=<токен бота> PASSWORD_PEPPER=<длинная случайная строка, например openssl rand -hex 32>
   ```
   `PASSWORD_PEPPER` менять нельзя: от него зависят пароли всех игроков.
4. Деплой: `supabase functions deploy tg-auth`, `supabase functions deploy generate` и `supabase functions deploy custom-plate`.
   У `tg-auth` включить «verify JWT = off» (`--no-verify-jwt`): её зовут до входа.
5. В `_shared/cors.ts` заменить `*` на домен Mini App перед выходом в прод.

Логика: клиент шлёт `initData` в `tg-auth`, получает сессию (access/refresh token) и дальше зовёт `generate` и SQL-функции (`supabase.rpc`) с этим JWT. Баланс, цены и редкость считает только сервер.

Тесты `npm test` проверяют, что серверный движок даёт те же результаты, что клиентский, и что проверка подписи Telegram работает.

## Магазин (shop.sql, custom-plate)

- **Платный регион.** Прокрут с выбранным регионом стоит 3000 ₽ + доплата `REGION_FEE_BASE × mult²` (округление до 100). «Все регионы» бесплатно. Доплату считает `generate` (`regionFee` в `_shared/engine.ts`) и списывает атомарно в `commit_plate_fee`. Клиент зеркалит формулу в `config.js` (`regFee`) только для показа цены.
- **Свой номер.** Функция `custom-plate`: `quote` считает цену, `buy` покупает. Цена: `CUSTOM_BASE × комбинация^CUSTOM_EXP × множитель цифр × регион`, минимум 200 000 ₽ (`customPlate` в `_shared/engine.ts`). Покупка не меняет статистику (выпало, редкости, рекорд), опыт и доллары. Купить и продать за 50% невыгодно (проверяет тест).
- **Косметика.** Каталог в таблице `shop_items` (зеркало: `SHOP` в `js/config.js`, сверяет `tests/shop.test.mjs`). Купленное лежит в `players.owned`, надетое в `players.equip` (`skin`, `title`, `drop`). Титулы и рамки других игроков отдаёт `get_styles(ids)`.
- Цены и множители подбираются константами: `REGION_FEE_BASE`, `CUSTOM_BASE`, `CUSTOM_EXP` в `_shared/engine.ts` и цены в `shop.sql` + `config.js`.
