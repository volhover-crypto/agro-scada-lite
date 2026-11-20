# BACKEND_HANDOFF v1 — Agro-SCADA Lite (дашборд поверх «Vega»)

Дата: 20.11.2026. Статус: на утверждении. Исполнитель: бэкенд (n8n + PostgreSQL 16, мост vega-bridge).
Стек не меняется. Документ задаёт ЧТО система должна делать; КАК — решает бэкендер.

## 0. Рамка и принятые решения (кратко)
- Цепочка: модем → LoRa → БС (Vega Server, до 2 с перекрытием) → bridge → n8n → PG. Дедуп `UNIQUE(dev_eui,fcnt,port)`.
- Вся логика (правила, расписания, тревоги, эскалация, команды) — воркфлоу n8n. Все настройки — таблицы PG (БД `vega`).
- API дашборда — webhook-узлы n8n под `/webhook/*`; статика `/dash/*`; остальное 403 (Caddy).
- Интернет и каналы оповещения — per-клиент (настройка `client_settings`).
- Модемы с исполнителями — LoRaWAN класс C; только датчики на батарее — класс A.
- Модем отдаёт готовые значения и подписывает каждый канал: код параметра + уровень + номер датчика.
- «Выполнено» — только по ack модема. Журнал — только добавление.
- Время: хранить timestamptz, отдавать ISO 8601 с поясом; пояс развёртки Europe/Moscow.

## 1. Модель данных (новые таблицы, БД `vega`)
Существующая `measurements` не меняется. Типы ориентировочные.

### 1.1 Иерархия
| Таблица | Поля |
|---|---|
| `farms` | id, name |
| `objects` | id, farm_id, name, object_type ('vineyard','orchard','greenhouse','pump_station','field','other'), lat, lon, tz (default 'Europe/Moscow') |
| `posts` | id, object_id, name, plot_name, lat, lon |
| `base_stations` | id, object_id, name, code ('bs1','bs2'), last_seen |

### 1.2 Устройства и каналы
| Таблица | Поля |
|---|---|
| `modems` | dev_eui PK, dev_name, object_id, lorawan_class ('A'/'C'), uplink_interval_s, fw_version, bat_mv, margin_db, last_seen, link_status |
| `param_dict` | code PK (smallint), name, unit, kind ('analog','counter','discrete') |
| `channels` | id, dev_eui, param_code, level_cm (−глубина/+высота/0), sensor_no, first_seen, last_value, last_ts, status ('assigned','unassigned','unknown_code') |
| `bindings` | id, channel_id, post_id, display_name, range_min, range_max, offset, factor (default 1), valid_from, valid_to (NULL = действует), created_by |
| `tags` | id (`{dev_eui}/{code}/{level}/{no}`), channel_id, source ('modem','external','sim') |
| `tag_values` | tag_id, ts_measured, ts_received, value, quality, origin ('live','backlog'), UNIQUE(tag_id, ts_measured) |

Справочник `param_dict` v1: 01 t воздуха °C; 02 влажн. воздуха %; 03 влажн. грунта %; 04 t грунта °C; 05 EC мСм/см; 06 давл. системы бар; 07 давл. воздуха гПа; 08 влажн. листа %; 09 осадки мм; 0A ветер м/с; 0B радиация Вт/м²; 0C расход м³/ч; 0D объём м³; 0E уровень см; 0F дискр. вход 0/1.

### 1.3 Исполнители и команды
| Таблица | Поля |
|---|---|
| `actuators` | id, dev_eui, output_no, type ('pump','valve','fan','window','starter','relay'), name, post_id, mode ('auto','manual'), mode_changed_at, set_state, fact_state, fact_until, default_duration_s, max_duration_s, interlock_conditions JSONB (резерв, пусто в MVP) |
| `command_defs` | id, actuator_id, action ('on','off','open','close'), confirm_policy ('none','manual_only','manual_and_rule_approval','always') default 'manual_and_rule_approval' |
| `commands` | uuid PK, cmd_id (uint32, уникален на модем), command_def_id, source ('manual','schedule','rule'), source_ref, duration_s, status, created_by, created_at, expires_at, status_history JSONB, result_code |
| `schedules` | id, actuator_id, action, cron/time+days, duration_s, enabled, approval_status, approved_by, approved_at |
| `rules` | id, name, condition JSONB, action JSONB, hysteresis, min_pause_s, on_no_data ('skip','fallback_schedule'), fallback_schedule_id, enabled, approval_status, approved_by, approved_at, last_fired_at |

### 1.4 Тревоги и оповещения
| Таблица | Поля |
|---|---|
| `alarm_defs` | id, tag_id или actuator_id/dev_eui, type ('threshold','rate','link','cmd_unacked','state_mismatch','modem_immediate'), params JSONB, priority 1–4, hysteresis, delay_samples (default 1), chain_id, enabled |
| `alarms` | id, alarm_def_id, state ('active_unacked','active_acked','cleared_unacked','closed'), raised_at, value, acked_by, acked_at, cleared_at, escalation_step |
| `notify_channels` | id, type ('push','telegram','sms','email'), address, enabled |
| `escalation_chains` | id, steps JSONB: [{after_min:0,channels:[..]},{after_min:10,channels:[..]},{after_min:20,channels:'all'}] |
| `client_settings` | internet_allowed bool, allowed_channels[], external_sources_allowed bool |

### 1.5 Сервисные
| Таблица | Поля |
|---|---|
| `users` | id, login, password_hash, role ('universal') |
| `sessions` | token_hash, user_id, expires_at |
| `audit_log` | id, ts, actor (user_id или 'system:<workflow>'), event, entity, entity_id, before JSONB, after JSONB — только INSERT |
| `external_sources` | id, provider, object_id, params JSONB, enabled, last_ok |
| `dashboards` | id, object_id, name, layout JSONB (виджеты: tag_id, вид, пороги) |

## 2. Нормализация данных (воркфлоу «ingest»)
Система должна для каждой новой строки `measurements` (порт 2):
1. Обновить `modems.bat_mv`, `margin_db = margin/100`, RSSI/SNR из `receptions`, `last_seen`.
2. Рекурсивно извлечь записи LIVE и BACKLOG (включая `inner`).
3. Для каждой подписанной записи канала найти или создать `channels` по (dev_eui, code, level, no):
   - код есть в `param_dict` → status 'unassigned', создать `tags`;
   - кода нет → status 'unknown_code'.
4. Записать `tag_values`: ts_measured = время записи/cycle_ts, иначе ts_server (quality += 'ts_received'); origin = live/backlog.
5. Применить к значению активную привязку на ts_measured: value×factor+offset.
6. Качество: 'good'; 'out_of_range' если вне range; 'sensor_error' если модем сообщил статус ошибки; 'sim' для симулятора.
7. Для origin='live' и канала со status 'assigned' — передать значение в проверку тревог и правил. BACKLOG и неназначенные каналы НЕ запускают тревоги и правила.
`decoded_error` → только запись в журнал ingest, значения не создаются.

Статусы, вычисляемые по времени (воркфлоу раз в 1 мин):
- тег 'stale': нет значения дольше 2×uplink_interval + 120 с;
- модем 'offline': нет пакета дольше 3×uplink_interval → событие device.link_changed;
- БС 'offline': нет пакетов через неё дольше 3×макс. интервала.

## 3. Команды
### 3.1 Создание (POST /webhook/commands)
Проверки по порядку, при отказе — HTTP 422 с кодом:
1. `idempotency_key` уже был → вернуть существующую команду (200).
2. Режим 'manual' и source≠manual → отказ 'MODE_MANUAL', запись `schedule.skipped`/`rule.skipped`.
3. action='on' для типов pump/valve/fan/starter/relay: duration_s обязателен (иначе default_duration_s); > max_duration_s → 'DURATION_OVER_MAX' (не урезать).
4. Политика подтверждения (раздел 3.3) → статус 'awaiting_confirm' или 'queued'.
5. В очереди уже есть неотправленная команда для этого выхода → старой статус 'superseded'.
6. Модем offline → поставить в очередь, expires_at = now+30 мин, в ответе warning 'MODEM_OFFLINE'.

### 3.2 Статусы
`created → awaiting_confirm → queued → sent_gw → acked → completed`
Ветви: `cancelled` (отказ/истекло подтверждение/истёк TTL), `superseded`, `timeout`, `rejected` (ack с кодом ≠0).
- sent_gw — по подтверждению передачи шлюзом/мостом. НЕ означает исполнения.
- acked — по ack модема (0x30) с совпавшим cmd_id; обновить actuators.fact_state, fact_until.
- timeout: класс C — 120 с после sent_gw; класс A — 2×uplink_interval. Без автоповтора. Если source≠manual → тревога приоритета 2 'cmd_unacked'.
- completed: по истечении fact_until или по ack команды off.
- set_state ≠ fact_state дольше таймаута → тревога 'state_mismatch'.
Каждый переход — запись в `status_history` и `audit_log`, событие command.status_changed.

### 3.3 Политика подтверждения (D14)
| Политика | manual | schedule/rule |
|---|---|---|
| none | сразу | сразу |
| manual_only | awaiting_confirm | сразу |
| manual_and_rule_approval | awaiting_confirm | сразу, если approval_status='approved', иначе skipped |
| always | awaiting_confirm | awaiting_confirm; нет подтверждения за 10 мин → cancelled + оповещение |
Команда off — всегда без подтверждения. Ужесточение политики → approval_status связанных правил/расписаний = 'pending'.

### 3.4 Продление
Повтор on с новым cmd_id на работающем выходе: fact_until = now + duration (≤ max). Повтор с тем же cmd_id модем не исполняет, повторяет прежний ack.

### 3.5 Формат порта 3 (проект, подтверждает прошивка)
Даунлинк: cmd_id u32 | output u8 | action u8 (0 off,1 on,2 open,3 close) | duration_s u32 (0 для open/close). Big-endian.
Аплинк: 0x20 состояние выхода (output u8, state u8: 0 выкл,1 вкл,2 авария,3 открыто,4 закрыто,5 промеж., remain_s u16);
0x30 ack (cmd_id u32, result u8: 0 принята,1 отклонена,2 занят,3 неверный формат,4 вне лимита, state u8, remain_s u16);
0x40 немедленная тревога (code u8, level, no, event u8 1/0, value).
Модем хранит последние 8 cmd_id и сам выключает выход по duration (аппаратный fail-safe).

### 3.6 Немедленные события
Мост передаёт ack (0x30), состояние (0x20) и немедленные тревоги (0x40) в n8n сразу (webhook), не дожидаясь 5-минутного опроса.

## 4. Расписания и правила
- Проверка расписаний — шаг ≤ 1 мин, по tz объекта. Пропущенный запуск (нет связи, ручной режим, не утверждено) не догоняется: `schedule.skipped` с причиной.
- Правило проверяется на каждое новое live-значение своих тегов с quality='good'. Условие ложно по гистерезису; повтор не раньше min_pause_s. Тег stale/offline → on_no_data.
- Пересечение расписаний на одном выходе — предупреждение при сохранении (API возвращает warning), исполнение = продление.
- Ручной режим без срока; через 24 ч оповещение «устройство в ручном режиме».

## 5. Тревоги и эскалация
- Типы: threshold, rate (Δ за окно, напр. давление −0,5 бар за 10 мин), link, cmd_unacked, state_mismatch, modem_immediate.
- Срабатывание: условие держится delay_samples замеров; снятие — с гистерезисом.
- Состояния: active_unacked → active_acked → closed; снялась без подтверждения → cleared_unacked (остаётся в списке до ack).
- Приоритеты: 1 все разрешённые каналы + эскалация; 2 push+telegram; 3 push; 4 только журнал.
- Эскалация по `escalation_chains` (по умолчанию 0 / 10 / 20 мин). Каналы фильтруются `client_settings.allowed_channels`; недоступный канал → запись в журнал, не ошибка.
- Пример: tag `…/06/0/1` = 1,2 бар, порог < 1,5, приоритет 1 → модем шлёт 0x40 → тревога сразу → push/Telegram → нет ack 10 мин → SMS резервному контакту.

## 6. Внешние источники (погода)
Только при `external_sources_allowed`. Значения пишутся в те же `tags/tag_values` (source='external'), с типом 'forecast' и ts_measured = время прогноза. Недоступность > 2 периодов опроса → quality 'stale', правила по on_no_data.

## 7. API (webhook n8n). Авторизация
- `POST /webhook/auth/login` {login,password} → {token, expires_at}. `POST /webhook/auth/logout`.
- Все прочие: заголовок `Authorization: Bearer <token>`; нет/истёк → 401. Общий header-auth n8n в браузер не передаётся.
- Ошибки: `{ "error": { "code": "DURATION_OVER_MAX", "message": "Максимум 4 ч" } }`.

| Метод и путь | Назначение |
|---|---|
| GET /webhook/objects, /posts, /modems, /channels?status=unassigned | справочники и списки |
| POST/PUT /webhook/bindings | привязка канала к посту (закрывает старую, valid_from=now) |
| GET /webhook/tags/current?ids=… | последние значения с quality, ts_measured, ts_received |
| GET /webhook/tags/history?ids=…(≤8)&from&to&agg=avg/min/max&step | графики, наложение |
| GET /webhook/actuators?object_id= ; PUT /webhook/actuators/{id}/mode | устройства, Авто/Ручной |
| POST /webhook/commands ; POST /webhook/commands/{uuid}/confirm ; POST …/cancel ; GET /webhook/commands/{uuid} | команды |
| GET/POST/PUT /webhook/rules, /schedules ; POST …/{id}/approve | правила, расписания |
| GET /webhook/alarms?state&priority&object_id ; POST /webhook/alarms/{id}/ack | тревоги |
| GET/PUT /webhook/settings/* (command_defs, alarm_defs, chains, channels, client) | настройки |
| GET /webhook/audit?from&to&entity&actor | журнал |
| GET /webhook/updates?since=<ts> | изменения значений, статусов команд и тревог с момента since (UI опрашивает каждые 30–60 с; при активной команде — 5 с) |
| GET /webhook/export?ids&from&to&format=csv | экспорт (should) |

Пример POST /webhook/commands:
```json
{"command_def_id":12,"duration_s":1800,"idempotency_key":"ui-7c1e-001"}
```
Ответ:
```json
{"uuid":"c-7f2a","cmd_id":40213,"status":"awaiting_confirm","expires_at":null,"warnings":[]}
```

## 8. Безопасность
Правила брифинга бэкенда сохраняются (UI n8n и мост наружу не проксировать; пароли только в .env). Дополнительно: пароли пользователей — хэш; токен сессии хранится хэшем; rate-limit на /auth/login (5 попыток/мин); журнал без UPDATE/DELETE.

## 9. Симулятор (№37)
Воркфлоу «sim»: генерирует строки как от модема (source='sim', quality 'sim') и отвечает ack на команды с настраиваемыми задержкой/кодом/потерей. Включается флагом в client_settings; UI показывает «ТЕСТ».

## 10. Критерии приёмки
1. Новый модем с подписанными каналами: каналы появляются в «неназначенных» ≤ 1 цикл ingest; неизвестный код → 'unknown_code'.
2. Перепривязка канала не меняет значения истории до valid_from.
3. Пакет от двух БС → одно значение в tag_values.
4. BACKLOG-значения видны на графике, тревоги и правила не срабатывают.
5. Тег без данных > 2 интервалов + 2 мин → quality 'stale' в /tags/current.
6. Команда on без duration → подставлен default; > max → 422 DURATION_OVER_MAX.
7. Повтор POST с тем же idempotency_key → та же команда, вторая не создаётся.
8. Команда при policy=manual_only из UI → awaiting_confirm; после /confirm → queued.
9. Ack 0x30 result=0 → acked и fact_state обновлён; нет ack 120 с (класс C) → timeout, автоповтора нет.
10. Ручной режим → расписание не исполнено, в журнале schedule.skipped 'MODE_MANUAL'.
11. Модем offline → команда queued с expires_at +30 мин; по истечении → cancelled.
12. Немедленная тревога 0x40 → запись в alarms ≤ 30 с после приёма мостом.
13. Тревога P1 без ack 10 мин → escalation_step=1, отправка по шагу цепочки; запрещённый канал пропущен с записью в журнал.
14. Каждое действие из пп. 6–13 есть в audit_log с actor.
15. Запрос без токена → 401; UI n8n и мост недоступны через Caddy.

## 11. Открытые вопросы к бэкенду/прошивке
1. Точный формат подписанных записей каналов (поля, типы) — от прошивки.
2. Подтверждение формата порта 3 (п. 3.5).
3. Механизм подтверждения передачи шлюзом (sent_gw) в Vega Server.
4. Push-уведомления в LAN-only: через что (PWA web-push требует интернет) — per-клиент.
