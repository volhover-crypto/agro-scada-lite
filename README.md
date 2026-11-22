# Agro-SCADA Lite — фронтенд

Адаптивное веб-приложение (PWA) для мониторинга агро-объектов (LoRaWAN-датчики, посты, базовые станции) и управления исполнительными устройствами (насосы, клапаны, вентиляторы, форточки, реле). Бэкенд (n8n + PostgreSQL) делает отдельный исполнитель; фронтенд работает по контракту против мока (MSW) и переключается на реальный API одной переменной окружения.

## Документация

- Спецификации пакета: `docs/spec/` (01–09, справочные BACKEND_*)
- Контракт API — единственный источник правды: `contract/03_API_CONTRACT.yaml`
- Ход работ: `docs/PROGRESS.md` · Решения: `docs/DECISIONS.md` · Вопросы: `docs/QUESTIONS.md` · Запросы к контракту: `docs/CONTRACT_REQUESTS.md`

## Стек

React + TypeScript (strict) + Vite; данные — TanStack Query, состояние UI — Zustand; графики — Apache ECharts, 3D — three.js (@react-three/fiber), карта — Leaflet; мок — MSW. Тесты: Vitest + Testing Library; e2e — Playwright.

## Команды

| Команда           | Назначение                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `npm run dev`     | dev-сервер (мок включён)                                                                         |
| `npm run build`   | прод-сборка в `dist/` (base `/dash/`)                                                            |
| `npm run preview` | предпросмотр сборки                                                                              |
| `npm run lint`    | ESLint + проверка форматирования Prettier                                                        |
| `npm run test`    | Vitest, одноразовый прогон                                                                       |
| `npm run e2e`     | Playwright (сначала `npx playwright install`)                                                    |
| `npm run gen:api` | типы API из `contract/03_API_CONTRACT.yaml` → `src/api/types.gen.ts` (ручные типы API запрещены) |

## Переменные окружения

| Переменная       | dev        | prod       | Смысл                      |
| ---------------- | ---------- | ---------- | -------------------------- |
| `VITE_USE_MOCK`  | `true`     | `false`    | мок (MSW) или реальный API |
| `VITE_API_BASE`  | `/webhook` | `/webhook` | базовый URL API            |
| `VITE_BASE_PATH` | `/`        | `/dash/`   | base path сборки           |

Секретов в репозитории нет; персональные значения — через `.env.local` (в `.gitignore`).

## Развёртывание

Прод-артефакт `dist/` раздаётся Caddy по `/dash/*` (SPA fallback на `/dash/index.html`). Подробнее — `README_DEPLOY.md` и `docs/spec/09_INTEGRATION_CHECKLIST.md`.
