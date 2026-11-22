# AUDIT_REPORT — передача проекта (2026-11-22)

Аудит на момент коммита `03d8556` (main). Все утверждения снабжены ссылкой на файл/коммит/вывод команды. Дата аудита — 2026-11-22.

## 1. Сводка

1. Готово: фронтенд T01–T19 по `docs/spec/08_TASKS_PLAN.md` — код, мок, тесты (227 unit + 39 e2e), PWA, прод-сборка без мока, документация, выкладка на GitHub.
2. Блокирующего нет: воспроизводимость с чистого клона доказана (§3), секретов нет (§2, шаг 0.2).
3. Не готово (не фронтенд): бэкенд (часть B чек-листа 09), инфраструктура (часть C), совместная приёмка (часть D) — `docs/spec/09_INTEGRATION_CHECKLIST.md`.
4. Отклонения от задания передачи: PR-ы на слитые ветки технически невозможны (§8.1), имя репозитория отличается от указанного (§8.2).
5. Дефектов кода, найденных аудитом, не обнаружено; известные ограничения — §8.

## 2. Состояние репозитория

- Ссылка: https://github.com/volhover-crypto/agro-scada-lite.git (создан владельцем, Private — подтверждение видимости у владельца).
- Ветки на origin: 21 — `main`, `task/01-skeleton` … `task/19-integration` (19), `fix/p3-contrast` (предок main, без уникальных коммитов; `git log main..fix/p3-contrast` пуст). Проверка: `git ls-remote --heads origin | wc -l` → 21.
- Последний коммит main на момент аудита: `03d8556` «передача: порядок в репо…».
- Теги: `v0.T01`…`v0.T19` (19 аннотированных, `git ls-remote --tags origin` → 19 × v0.T) на коммитах, принятых владельцем: T01 `02fa291` … T19 `f6c9d20`.
- Секреты: `git log -p --all | grep -c` по паттернам `ghp_*|github_pat_|AKIA|xox*|sk-*|PRIVATE KEY|Bearer …20+` → **0**; `git log --all --oneline -- .env .env.local` → пусто (.env никогда не коммитился); в рабочем дереве `git grep` по `api_key|secret|password|token = …` вне мока/тестов → пусто. Демо-креды `demo/demo` — только в моке/тестах (spec 04 §2), не секрет.
- Трекаемые env-файлы: `.env.development`, `.env.production`, `.env.example` — только конфигурация (`VITE_USE_MOCK/VITE_API_BASE/VITE_BASE_PATH`), секретов не содержат (проверка 09A3, T19).
- `.gitignore` (`/.gitignore`): `node_modules/`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`, `.metrics/`, `.env`, `.env.local`, `.env.*.local`. Lighthouse-отчёты в репо не создавались (выводились во временный каталог `%TMP%`).
- Локальные пути `F:\` в отслеживаемых файлах: не найдены (была одна строка в `docs/QUESTIONS.md` В1 — обезличена в коммите `03d8556`).

## 3. Воспроизводимость (чистый клон из GitHub)

Клон: `git clone https://github.com/volhover-crypto/agro-scada-lite.git` во временный каталог, HEAD = `03d8556`. Node v24.19.0, npm 11.17.0. Все команды — вывод в логах аудита; ниже сводка:

| Команда                                 | Код выхода | Время        | Результат                                                             |
| --------------------------------------- | ---------- | ------------ | --------------------------------------------------------------------- |
| `npm ci`                                | 0          | 16 с         | зависимости по lockfile (npm предупреждает об `audit fix` — см. §8.6) |
| `npm run lint`                          | 0          | 7 с          | ESLint: 0 errors (16 известных warnings — §8.7); Prettier: чисто      |
| `npm run test`                          | 0          | 63 с         | Vitest: **34 файла, 227 passed, 0 failed, 0 skipped**                 |
| `npm run build` (`VITE_USE_MOCK=false`) | 0          | 15 с         | `dist/` 2,9 МБ; поиск по dist `mockServiceWorker\|мок\|msw` → пусто   |
| `npm run dev`                           | —          | ready 217 мс | HTTP 200 на `127.0.0.1:5199`, `<title>Agro-SCADA Lite</title>`        |

Вывод: репозиторий собирается с нуля без ручных шагов — главный дефект отсутствия воспроизводимости не обнаружен.

## 4. Статус задач

Статусы — «принята владельцем» (подтверждения — журналы `docs/PROGRESS.md`, приёмки в каждой записи). PR: слияния шли локальными fast-forward, ветки задач — предки main; PR-ы между ними GitHub не создаёт («No commits between»), вместо PR — тег `v0.TNN` и ветка на origin (§8.1). Критерии — из `docs/spec/08_TASKS_PLAN.md`.

| №   | Статус  | Ветка                   | PR / маркер | Коммит  | Критерий                                                               | Подтверждение                                                                                   |
| --- | ------- | ----------------------- | ----------- | ------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| T01 | принята | task/01-skeleton        | — / v0.T01  | 02fa291 | dev/build/test работают; base из VITE_BASE_PATH                        | да — чистый клон §3                                                                             |
| T02 | принята | task/02-tokens-theme    | — / v0.T02  | e6bb613 | витрина /dev/tokens; контраст ≥4.5                                     | да — e2e smoke.spec («витрина…», P1 Авария); правки контраста В9/В10 (93690c2, ba625f3)         |
| T03 | принята | task/03-api-client      | — / v0.T03  | ad7e9ac | типы из контракта; 401→редирект; 422→текст ru.ts                       | да — gen:api (types.gen.ts); unit router/client (401)                                           |
| T04 | принята | task/04-mock            | — / v0.T04  | ce79d31 | мок по схеме; 8 сценариев                                              | да — src/mocks/api-schema.test.ts (23 кейса); scenarios.test.ts                                 |
| T05 | принята | task/05-login           | — / v0.T05  | 3bfda77 | demo/demo входит; logout чистит; RATE_LIMIT                            | да — e2e login.spec (3 теста)                                                                   |
| T06 | принята | task/06-shell           | — / v0.T06  | 4ba8497 | 360 и 1920 px; баннер P1 pressure_drop                                 | да — e2e shell.spec (1920/360/баннер/ТЕСТ)                                                      |
| T07 | принята | task/07-widgets         | — / v0.T07  | cb7f62b | все статусы качества в quality                                         | да — e2e widgets.spec + quality.test.tsx                                                        |
| T08 | принята | task/08-charts          | — / v0.T08  | e55031b | 8 рядов; 9-й запрещён; агрегат                                         | да — e2e charts.spec («9-й запрещён», «30 дней»)                                                |
| T09 | принята | task/09-dashboard       | — / v0.T09  | 60a06b0 | сохранение layout через API; телефон — только порядок                  | да — e2e dashboard.spec (reload)                                                                |
| T10 | принята | task/10-scene3d         | — / v0.T10  | aaef15b | 07 §3.1; FPS ≥30 телефон; fallback                                     | частично — e2e scene.spec; **FPS — ручная проверка владельцем (D-34, DEFERRED_CHECKS)**         |
| T11 | принята | task/11-post-soil3d     | — / v0.T11  | 6032bb9 | 07 §3.2; ползунок; подсказка <2 глубин                                 | да — e2e post.spec                                                                              |
| T12 | принята | task/12-device-commands | — / v0.T12  | 0b83cfc | ветки статусов normal/cmd_fail/link_loss; OFF без диалога; idempotency | да — e2e device.spec (4 теста)                                                                  |
| T13 | принята | task/13-alarms          | — / v0.T13  | 6a06b5e | ack, фильтры, эскалация в pressure_drop                                | да — e2e alarms.spec                                                                            |
| T14 | принята | task/14-rules-schedules | — / v0.T14  | 9ad8a2f | правка утверждённого → pending + предупреждение                        | да — e2e rules-schedules.spec                                                                   |
| T15 | принята | task/15-audit           | — / v0.T15  | c6aaa6f | фильтры, пагинация, было/стало                                         | да — e2e audit.spec                                                                             |
| T16 | принята | task/16-settings        | — / v0.T16  | 9157ad6 | onboarding: 4 канала привязаны, исчезают                               | да — e2e settings.spec                                                                          |
| T17 | принята | task/17-pwa             | — / v0.T17  | 79e7c95 | Lighthouse PWA installable                                             | да — lighthouse@10 installable-manifest=1, service-worker=1; CDP installabilityErrors=[] (D-46) |
| T18 | принята | task/18-quality         | — / v0.T18  | 40785e2 | Perf ≥80, A11y ≥90 (mobile); e2e сценарии                              | да — Perf 98, A11y 100 (вход); mobile.spec, shell.spec баннер→ack                               |
| T19 | принята | task/19-integration     | — / v0.T19  | f6c9d20 | бандл без MSW; чек-лист 09A                                            | да — §3 build; 09A п.1–5 (журнал PROGRESS)                                                      |

Пометка «PR —» объяснена в §8.1; полный список критериев и валидации каждой задачи — `docs/PROGRESS.md` (таблица + журнал).

## 5. Контракт и мок

### 5.1. Версия и дифф

- `contract/03_API_CONTRACT.yaml`: `version: 1.0.0` (строка 4).
- Diff с `agent_pack/03_API_CONTRACT.yaml`: **идентичны побайтово** (`diff -q` — пусто, проверка T19/2026-11-22). Копия пакета в репо: `agent_pack/` без изменений (исключена из Prettier — `.prettierignore`).

### 5.2. Пути: контракт / мок / код / тест схемы

Список путей контракта (29) и мока совпадает 1:1 — извлечения: `grep "^  /" contract/03_API_CONTRACT.yaml` и `grep -oE "BASE \+ '[^']+'" src/mocks/handlers.ts` (29 маршрутов, `:id`/`:uuid` ↔ `{id}`/`{uuid}`). Покомпонентная таблица:

| Путь                                           | В контракте       | В моке               | Используется в коде (файл)                                     | Тест схемы                                  |
| ---------------------------------------------- | ----------------- | -------------------- | -------------------------------------------------------------- | ------------------------------------------- |
| /auth/login, /auth/logout                      | да (post)         | да                   | src/api/endpoints/auth.ts                                      | api-schema.test.ts                          |
| /objects, /objects/{id}                        | да (get/post/put) | да                   | src/api/endpoints/objects.ts                                   | api-schema.test.ts                          |
| /posts                                         | да (get/post)     | да                   | src/api/endpoints/objects.ts (usePosts)                        | api-schema.test.ts                          |
| /modems                                        | да (get)          | да                   | src/api/endpoints/modems.ts                                    | api-schema.test.ts                          |
| /channels                                      | да (get)          | да                   | src/pages/ChartsPage.tsx:195, src/api/endpoints/settings.ts    | api-schema.test.ts                          |
| /bindings                                      | да (post)         | да                   | src/api/endpoints/settings.ts (T16)                            | api-schema.test.ts                          |
| /tags/current, /tags/history                   | да (get)          | да                   | src/api/endpoints/tags.ts                                      | api-schema.test.ts                          |
| /actuators, /actuators/{id}/mode               | да (get/put)      | да                   | src/api/endpoints/actuators.ts                                 | api-schema.test.ts                          |
| /commands, /commands/{uuid}, /confirm, /cancel | да                | да                   | src/api/endpoints/commands.ts                                  | api-schema.test.ts                          |
| /rules, /rules/{id}, /rules/{id}/approve       | да                | да                   | src/api/endpoints/rules.ts                                     | api-schema.test.ts                          |
| /schedules, /schedules/{id}/approve            | да                | да                   | src/api/endpoints/schedules.ts                                 | api-schema.test.ts                          |
| /alarms, /alarms/{id}/ack                      | да                | да                   | src/api/endpoints/alarms.ts                                    | api-schema.test.ts                          |
| /updates                                       | да (get)          | да                   | src/state/updates.ts                                           | api-schema.test.ts                          |
| /dashboards, /dashboards/{id}                  | да                | да                   | src/api/endpoints/dashboard.ts                                 | api-schema.test.ts                          |
| /settings/{section}                            | да (get/put)      | да                   | src/api/endpoints/settings.ts                                  | api-schema.test.ts — **ослабленный** (§5.3) |
| /audit                                         | да (get)          | да                   | src/api/endpoints/audit.ts                                     | api-schema.test.ts                          |
| /export                                        | да (get)          | да (handlers.ts:757) | **фронтендом не вызывается** (поиск `'/export` по src — пусто) | api-schema.test.ts                          |

Метод-уровень (пара путь+метод) контролируется тестом схемы: `src/mocks/api-schema.test.ts` — 23 кейса, каждый сверяет фактический ответ мока со схемой контракта.

### 5.3. Ослабленные/пропущенные проверки схемы

1. `GET /settings/{section}` — `loose: true` для `command_defs` и `param_dict` (api-schema.test.ts:181, ~190): контракт описывает тело как `type: object` без деталей, мок отдаёт массивы — расхождение зафиксировано как запрос BR-FE-4 (принят владельцем 2026-11-21, `docs/CONTRACT_REQUESTS.md` строка 10); бэкендер должен типизировать разделы по-разделочно.
2. Полных пропусков (skip/todo) в unit-тестах нет: `grep "\.skip|todo:" src/ e2e/` — пусто. В e2e один runtime-skip: `e2e/scene.spec.ts:58` (fallback при отсутствии WebGL в браузере прогона) — по дизайну задачи T10, ручная проверка в DEFERRED_CHECKS.

### 5.4. Запросы к контракту BR-FE

| №       | Суть                               | Статус                                                 | Где отражено                                                                                                                                                                                                                                                                |
| ------- | ---------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-FE-1 | Данные БС в /updates               | Принято владельцем 21.11; **контракт ещё не обновлён** | до обновления — агрегат по модемам: src/app/layout/TopBar.tsx («● Связь»), D-19/D-32; в моке base_stations нет; tooltip «Статус БС появится после обновления контракта (BR-FE-1)»                                                                                           |
| BR-FE-2 | Раздел /settings/external_sources  | Принято; контракт не обновлён                          | пока только флаг `external_sources_allowed` из /settings/client — src/pages/SettingsPage.tsx:478–516; в моке раздела нет                                                                                                                                                    |
| BR-FE-3 | RATE_LIMIT: 429 + error.code       | Принято; реализовано                                   | мок: 5 попыток/60 с; фронт: src/i18n/ru.ts:452 (`RATE_LIMIT`), e2e login.spec («после 5 неудач — RATE_LIMIT»)                                                                                                                                                               |
| BR-FE-4 | По-разделочная типизация /settings | Принято; контракт не обновлён                          | мок отдаёт массивы; тест ослаблен (§5.3); фронт читает по разделам через useSettingsSection                                                                                                                                                                                 |
| BR-FE-5 | Состав разделов /settings          | **Открыт** (владелец/бэкендер)                         | влияет на enum разделов; мок отдаёт 5 разделов (command_defs, alarm_defs, chains, channels, client) + param_dict                                                                                                                                                            |
| BR-FE-6 | sim_mode только чтение             | Решение владельца 21.11                                | флаг только из /updates client_flags (src/state/updates.ts:62); метка «ТЕСТ» — TopBar.tsx:81; симулятор read-only — SettingsPage SimulatorTab; команды «идёт в симулятор» (D-18). Открытый подвопрос: запрет запуска реальных устройств по sim-данным — в CONTRACT_REQUESTS |
| BR-FE-7 | Форма PUT /settings/{section}      | **Открыт**                                             | фронт пишет только /settings/client (объект); списочные разделы read-only с пометками в SettingsPage                                                                                                                                                                        |
| BR-FE-8 | actuator_id в Alarm                | Открыт                                                 | «К устройству» ведёт на пост: src/pages/alarms-helpers.ts + AlarmsPage; D-43                                                                                                                                                                                                |
| BR-FE-9 | PUT /posts/{id}                    | Открыт                                                 | scene_x/y — только чтение: SettingsPage, таблица «Сцена»                                                                                                                                                                                                                    |

Первоисточник: `docs/CONTRACT_REQUESTS.md` (таблица + раздел «К передаче бэкендеру»).

### 5.5. Отклонения мока от контракта/канона (BACKEND_CANON §2)

- Время: ISO с поясом — `src/mocks/util.ts:6-8`, `iso()` возвращает `…+03:00` (MSK) — канон соблюдён; snake_case — соблюдён (seed/handlers); null вместо отсутствия поля — соблюдён (например `fact_until: null` в seed.ts:287); списки — массивы — соблюдён.
- Документированные свойства мока (не противоречат контракту, заданы 04_MOCK_SPEC): ускорение времени ×60 в сценариях (`src/mocks/virtualClock.ts`); `expires_at` при MODEM_OFFLINE +30 с вместо +30 мин (04_MOCK_SPEC §4: «в моке +30 с»); журнал синтезируется от `demo`.
- Расхождения, ждущие обновления контракта: BR-FE-1 (нет base_stations в /updates), BR-FE-2 (нет раздела external_sources), BR-FE-4 (тела /settings/{section} — массивы при `type: object` в схеме) — см. §5.4.
- `D-42` (DECISIONS): мок требовал duration для open/close вопреки канону §3.1 п.3 — исправлено в T12 (0b83cfc), длительность обязательна только для `action='on'`.

## 6. Поведение, важное для безопасности

| Требование                                                                                                                                                                                                                                     | Где реализовано                                                                                            | Тест                                                                                          | Сценарий мока                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Команда `on`: длительность обязательна; > max → ошибка DURATION_OVER_MAX, не урезать                                                                                                                                                           | src/pages/device-helpers.ts (валидация), src/i18n/ru.ts:448; кнопка блокируется                            | unit device-helpers.test; e2e device.spec «10 мин…»                                           | normal                                                           |
| Команда `off`/`close` — без диалога                                                                                                                                                                                                            | src/pages/DevicePage.tsx (confirm_policy none/manual_only ветвление)                                       | e2e device.spec:65 «ВЫКЛЮЧИТЬ — без диалога»                                                  | normal                                                           |
| Идемпотентность: idempotency_key, двойное нажатие — одна команда; FIX-1 (D-47): ключ живёт, пока исход попытки неизвестен (потерянный ответ → повтор с тем же ключом); «Повторить» после timeout — новая команда с duration_s исходной (FIX-2) | src/pages/useCommandActions.ts (ensureKey, классификация по ApiError.status)                               | unit DevicePage.test (два запроса — один ключ; duration_s=600); e2e device.spec:46 (dblclick) | normal, cmd_fail                                                 |
| «Выполнено» только после acked/completed                                                                                                                                                                                                       | src/widgets/StatusTrail (✓ только на acked/completed)                                                      | e2e device.spec:54,62; cmd_fail «Выполнено не появляется»                                     | normal, cmd_fail                                                 |
| Режим Ручной/Авто; отказ MODE_MANUAL; ошибка смены режима показывается (FIX-4)                                                                                                                                                                 | PUT /actuators/{id}/mode — src/api/endpoints/actuators.ts; текст src/i18n/ru.ts:447; ModeCard role="alert" | unit DevicePage.test (423 → mode-error) + e2e device.spec (FIX-4)                             | manual_mode (actuator id=3), тумблер «Ломать смену режима (423)» |
| Потеря связи: баннер «Нет связи…» + backoff 5→60 с; MODEM_OFFLINE — «команда ждёт до HH:MM», отмена по TTL                                                                                                                                     | src/state/updates.ts:93-97 (offlineSince), src/pages/DevicePage (warning)                                  | e2e device.spec:108 (link_loss)                                                               | link_loss (bs1 offline, 4 модема)                                |
| stale/offline данные не выдаются за свежие                                                                                                                                                                                                     | качество по 06_DESIGN_TOKENS: src/widgets/quality.tsx (ValueText, значки), Lamp/Gauge/Chart стили          | e2e widgets.spec quality; quality.test.tsx                                                    | quality                                                          |
| sim_mode: метка «ТЕСТ» на всех экранах; симулятор только чтение                                                                                                                                                                                | src/app/layout/TopBar.tsx:81; src/state/updates.ts:62; SettingsPage SimulatorTab (BR-FE-6, D-18)           | e2e shell.spec «метка ТЕСТ»; unit                                                             | quality (sim_mode=true)                                          |
| 401 → выход на /login; RATE_LIMIT показывается                                                                                                                                                                                                 | src/app/router.tsx (installUnauthorizedRedirect), src/api/client.ts; src/i18n/ru.ts:444,452                | e2e login.spec; unit router (T03)                                                             | — (401/429 ветки клиента)                                        |
| Токен: sessionStorage + память, чистится при logout и 401                                                                                                                                                                                      | src/state/session.ts (setSessionToken/clearSession, KEY='agro-scada.session.token')                        | unit session (T05); e2e login.spec logout                                                     | normal                                                           |

Не реализованных из списка пунктов нет. Дополнение 2026-11-22 (FIX-1..4 по решению владельца, D-47): идемпотентность при потерянном ответе, duration в «Повторить», блокировка включения/открытия при offline (текст «данные устарели с HH:MM»; выключение — ждёт решения владельца), ошибка смены режима + e2e. Слой «Режим Ручной/Авто» закрыт e2e (§8.8 решено).

## 7. Качество

- 7.1. Покрытие: процент покрытия не считается (coverage не запускался в задачах — профиль «gates green»; снапшоты crapper — `.metrics/`, в git не входят). Юнит: 227 passed / 0 failed (§3). e2e: полный сьют `npx playwright test` → **39 passed + 1 skipped (WebGL-fallback, scene.spec:58)**, последний прогон на `task/19-integration` (журнал T19 в PROGRESS). Список обязательных сценариев и их покрытие — §4 и журнал T18.
- 7.2. Lighthouse: запускался (T17/T18). Prod-сборка: installable — lighthouse@10 `installable-manifest=1`, `service-worker=1` + Chrome CDP `Page.getInstallabilityErrors=[]` (D-46: lighthouse@13 PWA-аудиты удалены из апстрима); mobile — performance 98, accessibility 100 (страница входа; внутренние страницы за авторизацией — ручной прогон, DEFERRED_CHECKS).
- 7.3. Бандл: `dist/` 2,9 МБ (чистый клон, §3); главный чанк `index-*.js` 340 КБ (raw), тяжёлые библиотеки — ленивые чанки (`react-three-fiber.esm` 918 КБ загружается только на сцене; размеры — `ls -la dist/assets`). MSW в prod-сборке: отсутствует — поиск `mockServiceWorker|мок|msw` по dist пуст (команда в §3; плагин stripMswWorker — vite.config.ts:10-17; локаль «Мок» вынесена в src/mocks/mock-ru.ts).
- 7.4. Лицензии (npx license-checker --summary, 641 пакет): MIT 538, Apache-2.0 32, ISC 25, BSD-2 12, BlueOak-1.0.0 11, BSD-3 9, (MIT OR CC0) 3, MPL-2.0 2, Hippocratic-2.1 2 (react-leaflet, @react-leaflet/core — см. §8.9), OFL-1.1 (шрифт Inter), CC-BY-4.0, 0BSD, Python-2.0/PSF-2.0, MIT* — по 1; `UNLICENSED` — сам пакет agro-scada-lite@0.1.0 (private, поле license не задано). Патентов/копилефт-рисков для внутреннего закрытого контура не выявлено; Hippocratic-2.1 — на решение владельца (§8.9).

## 8. Открытые вопросы и дефекты

Код продукта аудитом не менялся; ниже — всё найденное.

| №    | Что                                                                                                                                                                                                                                                                 | Где                                  | Серьёзность    | Кто решает                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------- | ---------------------------------------------------------------- |
| 8.1  | PR-ы задач в main невозможны: ветки task/NN — предки main (слияния локальные ff); GitHub возвращает «No commits between». Аудиторские маркеры — теги v0.TNN + ветки на origin. Ретроспективно создавать PR можно только переписыванием истории — запрещено условием | origin                               | низкая         | владелец                                                         |
| 8.2  | Имя репозитория `agro-scada-lite` ≠ `agro-scada-lite-fe` из задания. Переименование — GitHub Settings (remote URL переживёт редирект, но лучше обновить `git remote set-url`)                                                                                       | GitHub                               | низкая         | владелец                                                         |
| 8.3  | Доступ к репо для стороннего аккаунта не выдан (аккаунт не указан владельцем)                                                                                                                                                                                       | GitHub                               | средняя        | владелец                                                         |
| 8.4  | `PROGRESS.md` лежит в `docs/`, не в корне (задание §1.1). Не переносил: на него ссылаются 7 файлов, включая agent_pack (править который запрещено); корневой README.md даёт прямую ссылку                                                                           | README.md, docs/                     | низкая         | владелец                                                         |
| 8.5  | `/export` есть в контракте и моке, фронтендом не вызывается (handlers.ts:757; поиск по src пуст) — назначение пути уточнить у бэкендера (возможно, только серверная выгрузка)                                                                                       | contract/03_API_CONTRACT.yaml        | низкая         | бэкендер                                                         |
| 8.6  | `npm ci` печатает предложение `npm audit fix` (уязвимости в dev-зависимостях). Прод-бандл от этого не зависит; обновление devDeps — отдельная задача, в передачу не входило                                                                                         | package-lock.json                    | низкая         | владелец/кодер                                                   |
| 8.7  | 16 lint-warnings (react-refresh/only-export-components, react-hooks/exhaustive-deps в DevicePage.tsx:58) — известные, не блокеры, не ошибки; их устранение меняло бы код — не делалось                                                                              | src/pages/*                          | низкая         | кодер                                                            |
| 8.8  | ~~Режим Ручной/Авто покрыт unit-тестом и сценарием мока, но не e2e~~ — **закрыто 2026-11-22 (FIX-4): e2e device.spec, отказ через тумблер панели отладки (D-47)**                                                                                                   | src/pages/DevicePage                 | низкая         | кодер                                                            |
| 8.9  | react-leaflet v5 — лицензия Hippocratic-2.1 (этическая лицензия; стандартное использование агромониторинга ей разрешается, но финальную оценку даёт владелец)                                                                                                       | package.json                         | низкая         | владелец                                                         |
| 8.10 | Отклонения от MODEL_PLAN: T11/T12/T16/T18/T19 выполнены на GLM-flash вместо GLM-5.3 — все приняты владельцем, переделок не потребовали (журналы задач)                                                                                                              | docs/MODEL_PLAN.md, docs/PROGRESS.md | информационная | —                                                                |
| 8.11 | FPS ≥30 на телефоне (T10) и установка PWA на телефоне (T17) — ручные проверки владельцем, не выполнены                                                                                                                                                              | docs/DEFERRED_CHECKS.md §1           | средняя        | владелец                                                         |
| 8.12 | TODO/FIXME в коде: не найдено (`git grep TODO                                                                                                                                                                                                                       | FIXME                                | HACK           | XXX` вне agent_pack/docs — пусто). Отключённых тестов нет (§5.3) | —   | —   | —   |

Решения, принятые агентом самостоятельно, задокументированы в `docs/DECISIONS.md` (D-01…D-46) — аудит не выявил недокументированных решений.

## 9. Как проверить владельцу за 15 минут

1. Открыть https://github.com/volhover-crypto/agro-scada-lite — вкладка Branches: 21 ветка; Tags: v0.T01…v0.T19 (§2).
2. `git clone https://github.com/volhover-crypto/agro-scada-lite.git` в пустую папку → `npm ci` → `npm run test` — 227 passed (~1 мин) (§3).
3. `npm run dev` → открыть http://127.0.0.1:5199 — вход demo/demo → Обзор с карточками объектов, метки качества на виджетах.
4. `?scenario=pressure_drop` в адресе до входа → через ~20 с красный баннер P1 «Давление 1,2 бар ниже 1,5» → [Подтвердить] → баннер исчезает (e2e shell.spec, T18).
5. `VITE_USE_MOCK=false npm run build` → поиск «мок/msw/mockServiceWorker» по `dist/` — пусто (§7.3).

## 10. Следующая задача и что нужно для старта

1. Стыковка с бэкендом (09_INTEGRATION_CHECKLIST части B→C→D): бэкендер закрывает B (пути контракта, схема, /updates since), инфраструктура C (Caddy /dash/*, TLS), затем совместный прогон D на стенде Vega.
2. От владельца для старта: обновлённый `03_API_CONTRACT.yaml` с принятыми BR-FE-1..4 (+решения BR-FE-5/7/8/9), домен/стенд, решение по §8.2/§8.3.
3. Фронтенд после обновления контракта: `npm run gen:api` (генерация типов — единственный источник правды), переключение статуса БС с агрегата на `base_stations` (BR-FE-1), раздел external_sources (BR-FE-2), PUT-формы /settings (BR-FE-7) — по факту появления новых полей.
4. Ручные проверки (DEFERRED_CHECKS §1): FPS на телефоне, установка PWA — по возможности владельца.
