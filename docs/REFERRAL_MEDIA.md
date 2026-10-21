# Реферальная система «Друзья» и медиа-программа «Медиа»: запуск и интеграция

Реализация ТЗ v1.0 (18.10.2026). Всё серверное лежит в `supabase/`, клиент в `js/views/friends.js` и `js/views/media.js`.

## 1. Порядок запуска
1. SQL Editor, по порядку, после существующих миграций (`schema` … `bank`, `auction`, `bans`): `supabase/referral.sql`, затем `supabase/media.sql`. Оба файла можно повторять.
2. Edge Functions: `supabase functions deploy tg-auth --no-verify-jwt` (изменена: читает `start_param`), `media-proof`, `ref-cron --no-verify-jwt`, `media-named --no-verify-jwt`.
3. Storage: создать закрытый бакет `media-proofs` (Public = off).
4. Секреты: `BOT_TOKEN`, `CHANNEL`, `CRON_SECRET` (любая длинная строка), `STAFF_CHAT_ID` (чат штаба). Расписание: вызывать `ref-cron` раз в 15 минут (pg_net или планировщик Supabase) с заголовком `x-cron-secret`. Пример pg_cron + pg_net:
   ```sql
   select cron.schedule('ref-cron', '*/15 * * * *', $$select net.http_post(
     url := 'https://<проект>.supabase.co/functions/v1/ref-cron',
     headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'Content-Type', 'application/json'))$$);
   select cron.schedule('ref-week', '5 0 * * 1', $$select public.ref_week_close(0)$$);   -- призы недели топ-3
   ```
5. Штаб: заполнить `staff_roles` (tg_id, роль: trainee, moderator, senior, admin, chief) либо заменить тело `staff_level()` на чтение вашей таблицы штаба из promo.sql.
6. `js/env.js`: `REF_LINK_BASE` (например `https://t.me/<бот>/<приложение>?startapp=r_`) или `update ref_cfg set val = '"https://t.me/..?startapp=r_"' where key = 'link_base'`.
7. Бот (tg-bot, его кода в архиве не было): подключить `supabase/functions/_shared/staff-actions.ts`: `staffCallback` для callback_data `ref:`, `mp:`, `nm:` и `staffCommand` для `/media_stats`, `/media_queue`, `/ref_stats`. Сообщения с кнопками шлёт `ref-cron` (форматы в `_shared/staffmsg.ts`).
8. Донатный процент (выключен): в вебхуке оплаты вызвать `ref_donate_hook(player, stars, order)`, при возврате `ref_donate_refund(order)`, затем `update ref_cfg set val = 'true' where key = 'donate_on'`.
9. Правила: добавить `docs/RULES-19.md` в редакцию правил как раздел 19 (за 7 дней до запуска предупредить игроков).

## 2. Что где
| Часть ТЗ | Реализация |
|---|---|
| A1 ссылка, привязка | `ref_bind_core/ref_bind_new/ref_bind`, `tg-auth`, `refCodeOf` в `_shared/tg.ts` |
| A2 этапы | `ref_stages`, `ref_recount`, `player_days` (`ref_touch` при входе) |
| A3 награды, лестница, опции | `ref_cfg`, `ref_ladder`, `ref_boosts`, `ref_claim`, `ref_donate_hook` |
| A4 экран | `friends.js`, `friends.css`, плитка «Друзья» |
| A5 уведомления | `ref_outbox`, `players.can_dm`, `askWriteAccess`, рассылка в `ref-cron` |
| A6 антифрод | hold + `ref_release_row`, флаги speed/ring/cluster/limit, `ref_on_ban`, `ref_debt`, очередь review, `ref_review` |
| A7 экономика | `day_budget_rub`, `player_cap_rub`, `tests/ref-media-sim.mjs` |
| B1–B4 медиа | `media.sql`: аккаунты, ролики, просмотры, уровни, МК, удержание, пул, отзыв |
| B5 магазин, обмен | `media_shop_buy`, `media_convert`, `media_rates` |
| B6 номера «Медиа» | `plate_series`, `series_issue`, `media_plate_buy`, типы `media` и `friends`, `.plate.t-media` |
| B7 модерация | `media_review`, `media_queue_*`, `staff-actions.ts`, `media_audit` |
| B8 правила | `docs/RULES-19.md` |
| C5 тесты | `tests/referral.test.mjs`, `tests/media.test.mjs`, `tests/sql/ref_media.sql`, `tests/ref-media-sim.mjs` |

## 3. Решения, которые ТЗ оставляло открытыми (поменяйте, если нужно иначе)
- Стартовый набор приглашённому выдаётся сразу при привязке (запись в ledger с нулевым удержанием, она же проходит бюджет и бан-проверки). Удержание нужно наградам за этапы.
- Награды этапов получают `review`, если у связки есть флаг speed/ring/cluster/limit. Ступень «50 друзей» (500 000 ₽) выше суточного потолка 300 000 ₽, поэтому выплачивается одной, когда за последние 24 часа других выплат не было.
- Долг: новые реферальные награды не выдаются (как в ТЗ); погасить можно из баланса (`ref_debt_pay`). В МК долг, наоборот, гасится новыми начислениями (иначе заработать на выход было бы нечем); покупки и обмен при долге заблокированы.
- «100 прокруток без единой паузы» из A6.3 не реализовано: в базе нет времени отдельных прокруток. Работает правило «этап 2 быстрее 6 часов». Нужны метки времени прокруток, если хотите это условие.
- IP и отпечатки устройств не собираются (как в ТЗ).
- Проверка подписки при выдаче идёт через `ref-cron` (getChatMember) с записью в `ref_sub_check`. Если `sub_check = on` и проверки нет, выдача ждёт (не платит наугад). Выключатель: `ref_cfg_set('sub_check', '"off"')`.
- МК в $: курс `usd_per_mc = 0,0001` (по курсу покупки $ в банке 25 ₽ за МК), поэтому обмен в $ начинается примерно с 12 500 МК. Это сознательно «почти закрытый» путь; подберите при желании.
- Номер серии из МК продаётся на рынке дороже нуля, но его цена в ₽ выставляется ниже чистой суммы обмена, чтобы продажа номера не стала лазейкой для вывода МК.
- Название валюты «медиа-койны (МК)» рабочее, решение за владельцем (ТЗ B1).

## 4. Что проверить (я не мог этого сделать в среде без Postgres и без файлов event/clans/promo)
- Выполнить SQL на тестовой базе и прогнать `tests/sql/ref_media.sql`; при ошибке прислать вывод.
- `ref_stage3_ok`: имена таблиц ивента (`ev_runs`) и кланов (`clan_members`) угаданы, при несовпадении условие просто ложно.
- `ref_pair_flow`: считает только сделки рынка (по нику покупателя), таблицу обменов подключить самостоятельно.
- Серии «Друзья» (`СЕМ`, `ТОМ`, `КУМ`) и «Медиа» (`КЕК`, `МЕМ`, `ТОК`, `РЕК`, `ВАУ`, `ХАХ`, закрытые `ТОР`, `МАХ`) не пересекаются со словами из `js/named-text.js` (проверяет тест), но сверьте с блат-сериями в `engine.js`.
- Тип `media` и `friends` добавлены в `check` по `type` у `plates`, `market_listings`, `auctions` и в клиентский `TYPES` (вес 0). В `engine.ts` их нет (из прокруток не выпадают, как блат). Тесты `types.test.mjs` про TYPES падали и до моих правок из-за блатных (в архиве не было `event.sql` и актуального `engine.ts`).
