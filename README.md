# Генератор номеров

Кликер про автомобильные номера (Россия, Беларусь) для Telegram Mini App.
Клиент без сборки (чистые ES-модули), сервер на Supabase: прогресс, деньги, генерация и цены считаются только на сервере.

## Запуск

1. Поднять сервер по `supabase/README.md` (SQL, секреты, две Edge Functions).
2. Вписать `SUPABASE_URL` и anon/publishable key в `js/env.js`.
3. Раздать статику любым сервером (`npm run dev`, или `python3 -m http.server 5173`) и открыть **из Telegram** (BotFather → Mini App → адрес игры, нужен https).
   Вход идёт по подписи Telegram `initData`, поэтому в обычном браузере игра покажет «Не удалось войти».
   Через `file://` не откроется: браузеры не грузят модули с диска.
4. `npm test` — тесты логики (нужен Node 22+).

## Структура

```
index.html            разметка экранов (скелет), экран загрузки #boot
css/                  стили по слоям, подключаются в порядке из index.html
js/
  main.js             точка входа: подключает экраны, входит через Telegram, грузит данные, запускает игру
  env.js              адрес и публичный ключ Supabase
  config.js           константы и таблицы баланса (редкости, типы, цены улучшений, темы)
  util.js             $, fmt, esc, rnd...
  state.js            кэш данных игрока S (один объект) + преобразование строк БД. Ничего не пишет на диск
  platform.js         Telegram.WebApp и вибрация
  server.js           клиент Supabase, вход (tg-auth), загрузка игрока и номеров, rpc()
  data/regions.js     справочник регионов для интерфейса (должен совпадать с supabase/seed_regions.sql)
  engine.js           только для интерфейса: признаки номера для статистики сессии, «барабан»
  api.js              ДЕЙСТВИЯ игрока: всё, что меняет состояние, запрос к серверу (async)
  router.js           go(), render(), реестр экранов DRAW
  ui/                 плашка номера, эффекты, модалки, тема, состояние списка, actions.js (события)
  views/              по файлу на экран: main, list, catalog, upgrades, stats, theme, settings, profile, gen, album, achievements
supabase/
  schema.sql          таблицы, RLS, SQL-функции;  seed_regions.sql — регионы
  functions/          tg-auth (вход), generate (выдача номера), _shared/engine.ts (ПРАВИЛА игры)
tests/                тесты правил, входа, кэша клиента
```

## Правила, чтобы проект не развалился

1. **Состояние меняет только `api.js`**, и только через сервер. Экраны вызывают `await api.*` и перерисовываются.
   `S` — кэш: после ответа сервера `api.js` обновляет его. Исключение: настройки интерфейса идут через `api.setSettings` (применяются сразу, на сервер уходят пачкой).
2. **Игровые правила только на сервере:** `supabase/functions/_shared/engine.ts` (классификация, цена, регион) и SQL-функции. Клиент ничего не считает, только показывает. Таблицы баланса в `config.js` нужны для отображения и должны совпадать с SQL.
3. **Экран = файл в `views/`.** Он регистрирует себя строкой `DRAW.имя = drawИмя` (id блока в `index.html` — `v-имя`) и свои действия через `on({...})`. Новый экран: блок в `index.html`, файл во `views/`, импорт в `main.js`.
4. **Зависимости идут только вниз:** `config → util/state → data/engine → server → api → ui → router → views → main`. Обратных импортов нет.
5. **События: без `onclick="..."`.** В разметке пишем `data-click="имя" data-arg="значение"` (также `data-input`, `data-change`, `data-pointerdown` и т. д.), а функцию регистрируем в своём модуле: `on({имя: (arg, el, event) => ...})`. В `window` ничего не выставляется. Ошибка в имени покажет `нет действия: имя` в консоли.
6. **Не переприсваивать `S`**, только менять его поля.
7. **Любой запрос к серверу может упасть:** `api.*` бросает исключение, `main.js` показывает плашку «Нет связи с сервером». Отказы по правилам игры (не хватает денег) возвращаются значением.

## Сервер

Подробный запуск: `supabase/README.md`. Соответствие методов клиента и сервера:

| клиент | сервер |
|---|---|
| `api.generatePlate()` | Edge Function `generate` → SQL `commit_plate` |
| `api.sellPlates(ids)` | `sell_plates(ids)` |
| `api.movePlates(ids, to)` | `move_plates(ids, to_safe)` |
| `api.claimDaily()` | `claim_daily()` |
| `api.buyCapacity(k)` | `buy_capacity(kind)` |
| `api.buyAutosell()` / `autoToggle(k)` / `autosell()` | `buy_autosell()` / `autosell_toggle(k)` / `autosell()` |
| `api.bailout()` | `bailout()` |
| `api.setNick(n)` | `set_nick(n)` |
| `api.setGenPrefs(c, r)` | `set_gen_prefs(c, r)` |
| `api.setSettings({...})` | `set_settings(s)` |
| `api.resetProgress()` | `reset_progress()` |
