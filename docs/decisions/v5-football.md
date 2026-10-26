# Рішення v5 — football і синк

> **Звідки:** `docs/archive/football-plan-intermediate.md` — розділ 6, Фаза 5 (уроки 5.0, факти провайдера F1 … F10, P5-1 … P5-17, відоме), рев'ю 5a (R5a-1 … R5a-6), Фаза 5b (P5b-1 … P5b-9); підсумок правил синку зі старого основного плану (етап 4.3). Текст — **дослівно**, номери збережено.

## Що змінилось після 2026-10-08

| Рішення | Стан | Що тепер |
|---|---|---|
| P5-14, P5-15 (`isActive`, cron) | ✅ діє, уточнено | Cron пропускає завершені турніри; прапорець вимикає cron локально — [D36](D36-sync-operations.md) |
| «Черга на процес», «кілька інстансів» | ✅ діє | Тригери Redis і окремого worker-а — [D41](D41-single-instance-scaling.md) |
| P5b-7: групи ЧС не виводимо | ✅ діє | Групові таблиці за регламентом — `docs/ideas.md` |
| P5b-2: ліга сайдбару за замовчуванням | 🔁 уточнено | Спершу турнір «у грі»: env, якщо він «у грі», інакше перший «у грі», інакше як було — [D55](D55-home-page.md) |
| «`SyncRun` росте» | ⏳ | Очищення — M2.1 |
| Транзакційний пулер Supabase | ⏳ | M3.5, `docs/open-questions.md` OQ-11 |

Решта рішень — ✅ діє.

---

## 6. Синк: DB як джерело правди, провайдер — змінний

### 6.1 Архітектура `football/`

```
football/
  integration/
    football-provider.port.ts        ← інтерфейс FootballProvider + нейтральні типи (ProviderCompetition, ProviderMatch, …)
    football-data/
      football-data.client.ts        ← HTTP, ретраї, rate-limit (10 req/min free tier)
      football-data.mapper.ts        ← Fd* → Provider* (ЄДИНЕ місце, що знає формат football-data)
      football-data.provider.ts      ← implements FootballProvider
    football-integration.module.ts   ← провайдер через DI token FOOTBALL_PROVIDER
  persistence/
    football.repository.ts           ← доменні таблиці
    external-ref.repository.ts       ← resolve/upsert *ExternalRef батчами
    sync-run.repository.ts
  sync/
    football-sync.service.ts         ← працює ЛИШЕ з Provider* типами + ExternalRef
    football-live-throttle.service.ts← throttle з SyncRun (останній успішний LIVE), не in-memory
    football.cron.ts
  query/ …                           ← season-aware
```

### 6.2 Правила синку

1. **Нейтральні типи.** `FootballProvider` повертає `ProviderMatch { externalId: string; kickoffAt: Date; status: MatchStatus; stage: string; … }`. Sync-сервіс не бачить `Fd*`. Новий провайдер = новий адаптер + значення в `DataProvider`.
2. **Резолв id батчем.** `externalRefRepository.resolveClubIds(provider, externalIds[]) → Map<externalId, clubId>` одним запитом, а не upsert по одному.
3. **Власність полів.** Синк пише лише *provider-owned* поля (рахунок, статус, дата, назва, емблема). *Editorial* поля (`slug`, `isActive`, `sortOrder`, переклади, прив'язки постів) синк **ніколи** не перезаписує.
4. **Ідемпотентність і дельта.** `payloadHash` у `*ExternalRef`: якщо хеш не змінився, пропускаємо запис у БД (сотні матчів сезону → десятки реальних апдейтів).
5. **Транзакції по сторінці.** Сторінку матчів (50 шт.) пишемо в одній `$transaction`: або вся, або жодна.
6. **Standings замінюються атомарно** в межах `(seasonId, stage, groupName, type)`, а не всього турніру.
7. **SyncRun на кожен запуск.** Старт → `RUNNING` (partial unique = лок). Кінець → `SUCCEEDED` / `PARTIAL` / `FAILED` + `stats`. Адмінка показує останні запуски.
8. **Перехід сезону.** Синк бачить нового `currentSeason` у провайдера → створює `Season`, в одній транзакції знімає `isCurrent` зі старого й ставить на новий. Старі матчі й таблиці лишаються.
9. **Список турнірів** — `Competition where isActive` + їх `CompetitionExternalRef`. `FOOTBALL_COMPETITION_IDS` використовується лише в `seed.ts`.
10. **Ліміти free tier (10 req/хв).** ~5 запитів на турнір → повний синк 9 турнірів ≈ 5 хв. Повний синк — послідовно, раз на добу (cron); LIVE — лише активні турніри, в яких сьогодні є матчі.

### 6.3 Як розділені ліги й кубки

```
Competition (PL, LEAGUE)                        Competition (CL, CUP)
 ├ Season 2025/26 (isCurrent)                    └ Season 2025/26 (isCurrent)
 │  ├ SeasonClub × 20        ← склад ліги           ├ SeasonClub × 36
 │  ├ Standing (REGULAR_SEASON, TOTAL) × 20         ├ Standing (LEAGUE_STAGE, TOTAL) × 36   ← ліга-фаза
 │  └ Match × 380                                   └ Match: stage = LEAGUE_STAGE | PLAYOFFS | LAST_16 | … | FINAL
 └ Season 2026/27            ← окремо, не змішується
```

- **Таблиця ліги** = `Standing where seasonId = <поточний сезон>` (+ `stage`, `groupName`, `type`).
- **Клуби ліги** = `SeasonClub where seasonId = …` (а не `Club.leagueId`). Клуб може бути в PL і CL одночасно.
- **Кубки:** `Competition.type = CUP`. Групи / ліга-фаза → кілька наборів `Standing` в одному сезоні (`stage` + `groupName`). Плей-оф → `Match.stage`; UI будує сітку за стадіями.
- **Збірні (WC, EC):** `Club.kind = NATIONAL` (визначає mapper за даними провайдера); сезон-турнір з label `2026` / `2024`.
- **Вигляд сторінки за `type`:** LEAGUE → таблиця + тури; CUP → групи / ліга-фаза + сітка плей-оф.

**Чому НЕ таблиця на кожну лігу/кубок:**
- нова ліга = нова модель Prisma + міграція + новий репозиторій (суперечить D7: турнір = рядок у БД);
- неможливі наскрізні запити: «усі матчі Arsenal» (PL + CL + кубок), календар за датою;
- лайки/коментарі до матчу мали б FK на 9 різних таблиць;
- індекси `@@index([seasonId, …])` роблять вибірку однієї ліги такою ж швидкою, як окрема таблиця;
- якщо колись будуть мільйони матчів — Postgres LIST-partitioning `Match` за `competitionId` дає фізичне розділення при одній логічній таблиці. Зараз (~2.8k матчів) не потрібно.

### 6.4 Публічний API ліг

Префікс лишаємо `/football/leagues/...` (web не ламається); всередині — `Competition`.

| Endpoint | Відповідь |
|---|---|
| `GET /football/leagues` | `[{ slug, name, type, area, emblemUrl, currentSeason: { label } }]`, лише `isActive`, сортування `sortOrder` — для перемикача |
| `GET /football/leagues/:slug/clubs?season=` | клуби через `SeasonClub` |
| `GET /football/leagues/:slug/standings?season=` | `[{ stage, groupName, type, rows[] }]` |
| `GET /football/leagues/:slug/matches?season=&stage=` | матчі; для кубків — фільтр за стадією |
| `GET /football/leagues/:slug/dashboard` | форма незмінна для LEAGUE; для CUP `standings` = ліга-фаза / перша група |

`season` не передано → поточний (`isCurrent`).

---

#### 5.0 Уроки Фаз 2–4, враховані у Фазі 5

Врахувати (уроки Фаз 2–4 і рев'ю):
1. **`upsert` у Prisma 7 з driver adapter не атомарний** (`CommentThread` з `update: {}` → P2002 при паралельних вставках, Фаза 4). Паралельні синки різних турнірів ділять клуби (Arsenal — PL і CL) → вставка `Club` / `ClubExternalRef` / `SeasonClub` через `createMany({ skipDuplicates: true })` (`ON CONFLICT DO NOTHING`) + дочитування, або `isUniqueViolationOn` + повтор; голий `upsert` — лише там, де гонки немає
2. Помилки Prisma — лише через `src/prisma/prisma-errors.ts`: deadlock приходить як `P2010` / «голий» `DriverAdapterError`, не `P2034` (рев'ю R6)
3. Лок синку — частковий унікальний індекс `SyncRun_single_running_idx`: другий `RUNNING` на ту саму ціль → P2002 → «синк уже йде» (skip / 409), не 500
4. Транзакції — посторінково й короткі; блокування спільних рядків у стабільному порядку (напр. за `id`), інакше два синки ловлять deadlock на спільних клубах (правило 10 основного плану)
5. **Матчі не видаляти фізично:** `CommentThread` і `MatchLike` мають `onDelete: Cascade` від `Match` — видалення знищить коментарі й лайки. Скасований / перенесений матч — лише статус. Синк не чіпає `likeCount` / `dislikeCount`
6. `POST /football/live-touch` — публічний POST, що може витрачати квоту провайдера (рев'ю Фаз 1–4) → ліміт на IP (`ThrottlerGuard`) + не частіше ніж раз на N с на матч через `SyncRun`
7. Видимість матчу для коментарів / лайків: `visibleThreadWhere` пускає тред **будь-якого** матчу; якщо `Competition.isActive = false` ховатиме матчі на web — вирішити, чи ховати й тред / лайки (зараз — ні)
8. Web: `packages/types` `Match.date` → `kickoffAt` (використовують `FootballMatchStrip`, `MatchDetailView`); на сторінці матчу вже є `LikeBar`; API коментарів матчу готовий (UI — етап 8 основного плану)
9. Перевірка — як у Фазах 2–4: тимчасовий Nest на dev-БД, детерміновані гонки (два синки одночасно; синк + `live-touch`), контрольний прогін без фіксу; тестові дані прибирати

---

#### 5.1 Аналіз реальних відповідей football-data і рішення (2026-09-26)

Перед проєктуванням маппера — 15 справжніх GET до football-data v4 (PL, CL, WC, EC: competition / teams / matches / standings). Знайдено:
- **F1 — пагінації немає.** `/competitions/PL/matches?limit=5&offset=0` → усі 380 матчів (`resultSet.count: 380`). Старий цикл `if (batch.length < limit) break` не спрацьовує ніколи → до **50 однакових запитів** на турнір (~5,5 хв, 380 × 50 upsert-ів). «~5 запитів на турнір» з 6.2 — лише без цього циклу
- **F2 — `score.fullTime` містить серію пенальті:** WC 2026 GER–PAR `fullTime 4:5` = `regularTime 1:1` + `penalties 3:4`. Старий код показав би на сайті «4:5»
- **F3 — `standings[].group` для ліг — не група:** PL `"Matchday"`, CL `"League phase"`; справжні групи — `GROUP_A` (у матчах WC / EC). Без `?season` — лише `TOTAL`; **з `?season=` — `TOTAL` + `HOME` + `AWAY`** (уточнено реальним синком); `form: null`
- **F4 — standings EC 2024 → HTTP 404** (турнір є) — це «таблиці немає», а не збій синку. WC: без `?season` теж 404, а з `?season=2026` — **одна** таблиця `GROUP_STAGE` на 48 команд (`group: null`), без поділу на групи (уточнено реальним синком; для 5b: групи ЧС — лише з `Match.groupName`)
- **F5 — CL:** `currentSeason` закінчується `2027-01-27` (лише ліга-фаза), плей-оф ще не опубліковано; учасник плей-оф до жеребкування — `homeTeam.id: null` (захисно; у поточних даних немає)
- **F6 — `matchday` плей-оф:** WC — `null`, EC — 4–7 (для 5b: групування турів у кубках різне)
- **F7 — збірні ніяк не позначені:** `name === area.name` ламається на «Czechia» / «Czech Republic», «Bosnia-Herzegovina»; у збірних `runningCompetitions: []`, `venue: null`
- **F8** — `minute` у списку матчів немає (лише в LIVE); area ЧС — `INT`, не `WORLD`; `Club.slug = <name>-<externalId>` несе id провайдера в URL (суперечить розділу 4)
- **F9 — ліміт:** `X-Requests-Available-Minute`, `X-RequestCounter-Reset` (с). Пауза 6,5 с стоїть **після** кожного виклику в одному циклі — паралельні виклики (повний синк + `live-touch` + друге натискання в адмінці) її не бачать → 429
- **F10 — LIVE не оживає:** `live-touch` приймався лише для матчу зі статусом `LIVE` **у нашій БД**, а LIVE він стає лише після синку (курка-яйце); LIVE-синк брав `?status=LIVE` → завершений матч випадає з фільтра й лишається LIVE до наступного повного синку

| # | Рішення | Чому |
|---|---|---|
| P5-1 | Порт `FootballProvider` (DI-токен `FOOTBALL_PROVIDER`) з нейтральними `Provider*`; формат football-data знає лише `integration/football-data/`. Клієнт — **одна черга запитів на процес** (≥ 6,5 с між стартами), 429 → чекати `X-RequestCounter-Reset` і один повтор; 5xx / мережа — один повтор; помилки — `FootballProviderError`, не HTTP-винятки Nest; 404 на standings → «таблиці немає» | F9, F4; синк не бачить `Fd*` (6.2 п. 1) |
| P5-2 | Маппер: рахунок = `fullTime − penalties`; half-time, пенальті, `winner`; статуси 1:1 (`PAUSED`, `SUSPENDED`, `AWARDED`; `EXTRA_TIME` / `PENALTY_SHOOTOUT` → `LIVE`); `stage` — як є, `A-Z0-9_` (D18); група — лише `GROUP_*`, інше → `null`; label `2026` / `2025/26`; `NATIONAL` — для турнірів збірних (WC, EC); невідомий учасник → матч пропускається (`matchesUndecided`) | F2, F3, F5, F7 |
| P5-3 | Рівно **4 запити** на турнір: competition, teams, matches, standings; три останні — з `?season=<рік старту>` сезону з першого кроку. Відповідь про інший сезон → FAILED | F1; провайдер може перемкнути сезон посеред синку — дані не змішаються |
| P5-4 | Спільні сутності без голого `upsert`: `Area` — `createMany skipDuplicates` + дочитування; `Club` + `ClubExternalRef` — одна транзакція (за `externalId`), P2002 (`Club` / `ClubExternalRef`) або deadlock → відкат (без «сиріт» `Club`) і повторний resolve, до 3 спроб; `SeasonClub` — `createMany skipDuplicates`. Поля клубу оновлюються лише з повного `/teams` (з хешем); клуб, якого немає в `/teams` (лише в матчі / таблиці), створюється з неповними даними й з них **не** оновлюється | 5.0 п. 1; інакше хеш і поля «блимали б» між повним і неповним payload-ом |
| P5-5 | `Club.slug` — нейтральний: `slugify(name)`; зайнятий → `-<код країни>` → `-2…`; створюється один раз | F8, розділ 4; `Club` зараз порожня — міграція не потрібна |
| P5-6 | Дельта: `payloadHash` = SHA-256 нормалізованого `Provider*` зі стабільним порядком ключів (не сирого JSON — `lastUpdated`, odds, referees не тригерять запис). Без змін → жодного запису в доменну таблицю; `lastSyncedAt` посилань — один `updateMany` на чанк | 6.2 п. 4 |
| P5-7 | Матчі — чанки по 50, транзакція на чанк (timeout 30 с), оновлення в порядку `matchId` (той самий порядок у LIVE → без deadlock-ів); чанк, що впав, — один повтор, далі `matchesFailed` і `PARTIAL`. `Match` не видаляється; оновлення **не** містить `likeCount` / `dislikeCount` / `competitionId` / `seasonId` | 6.2 п. 5; 5.0 п. 4, 5 |
| P5-8 | Сезон — за `SeasonExternalRef`; новий → створити + ref; перемикання `isCurrent` в одній транзакції (зняти зі старого → поставити новому; partial unique). `label` — лише при створенні (він у URL) | 6.2 п. 8 |
| P5-9 | Standings — кожна таблиця `(seasonId, stage, groupName, type)` окремою транзакцією: `Season FOR NO KEY UPDATE` → `deleteMany` + `createMany`. Замінюються лише таблиці з відповіді | Серіалізує повний і LIVE-синк на одному сезоні (інакше P2002 на `Standing`); з FK-`KEY SHARE` вставки матчу не конфліктує (урок R5) |
| P5-10 | Лок `SyncRun.tryStart` — транзакція з `pg_advisory_xact_lock(provider+scope+ціль)`: застарілі `RUNNING` (повний > 10 хв, LIVE > 3 хв) → `FAILED` `STALE`; є `RUNNING` або (для LIVE) запуск молодший за інтервал → `null`; інакше `create`. P2002 → `null`. Кінець → `SUCCEEDED` / `PARTIAL` / `FAILED` + `stats` + `errorMessage` (≤ 500) | 6.2 п. 7; процес, убитий посеред синку (`nest --watch`), не блокує турнір назавжди; перевірка й запис атомарні |
| P5-11 | LIVE-вікно: статус `LIVE` / `PAUSED` / `SUSPENDED` або `SCHEDULED` з початком у `[now − 3 год, now + 15 хв]`. LIVE-синк: матчі `dateFrom = вчора … dateTo = завтра` (ловить щойно завершені), лише **оновлює** наявні матчі (створює — тільки повний синк під своїм локом); матч став `FINISHED` → оновити таблицю (+1 запит). Інтервал — `SyncRun` `MATCHES_LIVE` на турнір, ≥ 60 с (було 90 с у пам'яті процесу) | F10; 5.0 п. 6 |
| P5-12 | `POST /football/live-touch`: `ThrottlerGuard` на IP (10 / хв), `matchId` ≤ 64; приймається для матчу в LIVE-вікні (не лише зі статусом `LIVE` у БД). Web шле його для незавершеного матчу (не `FINISHED` / `CANCELLED` / `AWARDED` / `POSTPONED`) | F10; квота провайдера |
| P5-13 | Список турнірів: cron і `POST /football/sync` без тіла — `Competition where isActive` з ref-ом провайдера, за `sortOrder`. `competitionIds` у тілі — **наші slug-и** (будь-які наявні: явна дія адміна), невідомий → 400 `UNKNOWN_COMPETITION`; без ключа → 503 `FOOTBALL_PROVIDER_NOT_CONFIGURED`. `FOOTBALL_COMPETITION_IDS` API більше не читає (seed має власний список) → прибрати у Фазі 6 | D7, 6.2 п. 9 |
| P5-14 | Cron: повний синк — **кожні 2 год** (як зараз; 6.2 п. 10 казав «раз на добу» — переглянуто: LIVE-cron за замовчуванням вимкнено, тож раз на добу = результати застарівають до 24 год; після F1 це 9 × 4 × 12 = 432 запити / добу — менше, ніж зараз дає сам PL з багом пагінації); LIVE-cron (опційно, 5 хв) — лише активні турніри з матчем у LIVE-вікні | Без регресу свіжості |
| P5-15 | `isActive` (5.0 п. 7) = синк за cron-ом + видимість у `GET /football/leagues` (перемикач). Ліга за slug, її дашборд і сторінки матчів лишаються доступними (архів); треди / лайки матчів — як є (P4-1) | Вимкнений турнір не ламає посилань на матчі з коментарями |
| P5-16 | Query — через сезон: `?season=2025-26` / `2026` (у label `-` ↔ `/`), інакше `isCurrent`; невідомий → 404 `SEASON_NOT_FOUND`; турнір без сезонів (ще не синкали) → дашборд з `season: null` і порожніми списками, не 404. Коди `LEAGUE_NOT_FOUND`, `MATCH_NOT_FOUND`. Дашборд — форма `{ league, standings, fixtures }` + `season`; `standings` — головна таблиця: `TOTAL` першої стадії з `REGULAR_SEASON` → `LEAGUE_STAGE` → `GROUP_STAGE` → інші, перша група. «Наживо» у турах — `LIVE` + `PAUSED` | 6.4 |
| P5-17 | Публічні поля — як у v5 і `PostDetail`: `kickoffAt`, клуб `crestUrl` (+ `tla`), ліга `emblemUrl` / `type` / `area` / `currentSeason`; матч + `season { label }`, `stage`, `groupName`, half-time, пенальті, `winner`, `venueName`. `GET …/standings` → `[{ stage, groupName, type, rows }]` (6.4). Web — лише типи й точкові правки. Адмінка: `GET /football/sync-runs` (ADMIN) + таблиця запусків на дашборді | 6.4, 6.2 п. 7 |

---

**Знайдено під час перевірки (не код 5a):**
- ⚠️ **Транзакційний пулер Supabase (`:6543`) рве з'єднання:** запит на «мертвому» сокеті висить **~12–15 хв**, потім `ConnectionClosed` / `Connection terminated unexpectedly`. Відтворюється **без нашого коду** — цикл `SELECT 1` висів 15 хв 36 с; на сервері в цей час — сесія `idle in transaction`. Через session-пулер (`:5432`) прогони чисті. Для API це означає: HTTP-запит або синк можуть «зависнути» на 15 хв → бэклог (етап 14): `PrismaPg` з `keepAlive`, `connectionTimeoutMillis` і клієнтським `query_timeout`, перевірити на проді
- Зависання довше за `FULL_SYNC_STALE_AFTER_MS` (10 хв) дає змогу стартувати другому синку того ж турніру, поки перший висить; перший потім падає на мертвому сокеті — дані ідемпотентні, у гіршому разі `PARTIAL`

**Відоме, не робимо в 5a:**
- `live-touch` шлеться раз на відкриття сторінки: один глядач під час матчу бачить свіжі дані лише від інших `live-touch` або LIVE-cron (так було й раніше; на проді — увімкнути `FOOTBALL_LIVE_CRON_ENABLED`)
- Черга запитів до провайдера — на процес: кілька інстансів API ділять квоту ключа (збільшити інтервал або спільний лімітер)
- Кубки: `matchday` плей-оф — `null` (WC) або 4–7 (EC), групи WC — лише в `Match.groupName` (F4, F6) → вигляд кубка — 5b / етап 7
- `FOOTBALL_COMPETITION_IDS` більше не читається → прибрати з env у Фазі 6
- Повний і LIVE-синк одного турніру можуть іти одночасно (різні `scope`): повний синк, що отримав матчі раніше, може за свої секунди запису перезаписати свіжіший LIVE-запис того ж матчу. Самовиправляється наступним LIVE / повним синком; точне рішення — час отримання відповіді провайдера в умові запису (не робимо: вікно — секунди, дані не губляться назавжди)
- `SyncRun` росте (LIVE — до 60 запусків / год на турнір під час матчів) → очищення старих запусків (напр. разом із `SecurityCleanupCron`) — бэклог

---

#### Рев'ю 5a (2026-09-26, після перерваного виконання)

Виконання 5a перервалось уже після позначки ✅. Увесь код 5a перечитано проти P5-1…P5-17 і розділу 6, перевірено незалежно (статичні перевірки, unit, **новий** інтеграційний прогін, реальний ресинк).

| # | Проблема | Виправлення |
|---|---|---|
| R5a-1 | Черга football-data: 429 (`X-RequestCounter-Reset`) відсував лише **нові** запити; запит, що вже чекав у черзі, стартував за старим розкладом і перезаписував `nextRequestNotBefore` меншим значенням → повторний 429, повтор першого запиту — до скидання лічильника | Слот після кожної паузи перевіряє `nextRequestNotBefore` знову (`football-data.client.ts`); +5 unit-тестів черги на фейкових таймерах. Контрольний прогін на старому коді: тест з 429 падає (старти `0 / 6,5 / 13 с` замість `0 / 31 / 37,5 с`) |
| R5a-2 | `slugifyClubName`: літери без розкладу NFD (`ø ß ł ı æ œ đ ð þ ħ`) зникали: «FK Bodø/Glimt» → `fk-bod-glimt` | Транслітерація до очищення; +1 unit-тест. Dev-БД: усі 186 slug-ів звірено з новим алгоритмом — розбіжність одна, `fk-bod-glimt` → `fk-bodo-glimt` (сторінок клубів ще немає — етап 7) |
| R5a-3 | Label сезону вже зайнятий іншим id провайдера → «сирий» P2002 на `@@unique([provider, seasonId])` у журналі | `FAILED` з явною причиною до будь-яких записів («сезон 2026/27 уже прив'язаний до id …»): злиття двох сезонів в один `Season` змішало б матчі |
| R5a-4 | Адмінка: «вікно спостереження» 10 хв після «Синк» лежало в кеші TanStack без спостерігачів → GC через `gcTime` (5 хв) | `setQueryDefaults(…, { gcTime: Infinity })` |
| R5a-5 | Web: `live-touch` без `.catch` → неперехоплений reject на 429 (ліміт 10 / хв на IP досяжний: запит іде для будь-якого незавершеного матчу) | `.catch` — сторінка лишається з даними з БД |
| R5a-6 | Дрібне: мертвий `ExternalRefRepository.touchMatches`; «standings WC → 404» у коментарі провайдера, `CLAUDE.md`, `README.md` (насправді EC 2024; WC — одна таблиця на 48 команд); карта файлів `README.md` — шляхи до видалених файлів; коментар `SyncRunRow.stats` | Прибрано / виправлено |

---

#### 5b.0 Контекст (аналіз коду й даних, 2026-09-27)
- **SSR сайдбару не працював і до 5b:** `HydrationBoundary` обгортав лише стрічку, а `FootballSidebar` рендериться раніше за нього → у HTML головної — «Loading table…», дані з'являлись лише після гідрації (prefetch дашборду йшов, але в SSR не потрапляв)
- **Кубки в турах:** групування лише за `matchday` → у WC увесь плей-оф (32 матчі шести стадій, `matchday: null`) — один блок «Без туру»; у EC фінал — «Тур 7» (F6). Те саме на сторінці матчу
- **Таблиці кубків:** CL — `LEAGUE_STAGE` на 36; WC 2026 — одна `GROUP_STAGE` на 48 без груп (F4); EC 2024 — таблиці немає (404 провайдера), а сайдбар казав «потрібен синк» — хибна підказка
- Заголовок панелі — «Змагання / Таблиця» без назви ліги; емблеми провайдера PL / CL / WC темні — на чорному фоні їх не видно
- Next 16: `searchParams` — Promise і робить сторінку динамічною; нативний `history.pushState` синхронізується з `useSearchParams` (docs `linking-and-navigating`); `useSearchParams` на статичній сторінці без `Suspense` ламає `next build` — а `Navbar` є і на SSG-сторінках auth

#### 5b.1 Рішення

| # | Рішення | Чому |
|---|---|---|
| P5b-1 | Сервер: `?league=` (`leagueSlugFromParam`: перше значення, trim) або ліга за замовчуванням; `fetchQuery` списку ліг (і для перемикача, і для дефолту), паралельно prefetch постів і дашборду; **один `HydrationBoundary` на всю сітку** | SSR сайдбару з даними (5b.0); `?league=CL` відкривається напряму |
| P5b-2 | `resolveDefaultLeagueSlug(activeLeagues)` — чиста функція: env, якщо ліга серед активних, інакше перша за `sortOrder`; API недоступне → env | Вимкнена в адмінці ліга (P5-15) чи хибний env не дають 404 на головній |
| P5b-3 | Перемикання на клієнті — `history.pushState` (`useSelectedLeague`): без серверного рендеру, стрічка не перезапитується, дашборд — TanStack-кеш на лігу (повернення до ліги — без запиту); «Назад» / «Вперед» — попередня ліга | Швидко; URL лишається джерелом стану (SSR, посилання) |
| P5b-4 | Перемикач — disclosure: кнопка (`aria-expanded` / `aria-controls`) + справжні посилання `href="/en?league=CL"` (`aria-current`); звичайний клік перехоплено, Ctrl / ⌘ / середня кнопка — браузер (нова вкладка). Escape / клік поза / Tab за межі закривають, фокус — на кнопку. Групи «Ліги» / «Кубки» за `type`, порядок — `sortOrder` з API. Емблема — на білій плашці, `next/image` `unoptimized` (домен CDN провайдера не прив'язаний до `remotePatterns`) | Доступність, робота без JS, темні емблеми |
| P5b-5 | API: тур = `(stage, matchday)` у стадіях з турами (`REGULAR_SEASON`, `LEAGUE_STAGE`, `GROUP_STAGE` — `MATCHDAY_STAGES`), плей-оф = уся стадія (`matchday: null`, обидва матчі двоматчевого раунду разом); порядок — за часом стадій (найраніший / найпізніший матч стадії у списку), усередині — за `matchday`. `FixturesRound.stage` — адитивно; ліга — як і раніше | F6; нумерація турів плей-оф у провайдера різна (WC `null`, EC 4–7) |
| P5b-6 | Дашборд: `standingsTable: { stage, groupName } \| null` — яка таблиця в `standings` (форма незмінна, поле адитивне). Панель: «Сезон 2026/27» + «Таблиця» / стадія («Загальний етап», «Груповий етап») / група («Група A»); порожньо: `season: null` → «потрібен синк», сезон є → «Для цього сезону таблиці немає» | EC 2024 — провайдер таблиці не дає, синк не допоможе |
| P5b-7 | WC 2026 — таблиця провайдера як є («Груповий етап», 48, скрол у панелі), групи з `Match.groupName` **не** виводимо; група — підписом на картці матчу («· Група J») | Місце в групі, виведене з порядку загальної таблиці, може розійтися з регламентом (особисті зустрічі при рівності очок) — не показуємо вигадане місце; групові таблиці й перемикач груп — етап 7 |
| P5b-8 | Підписи стадій — `useFootballStageLabels` (переклад відомих стадій, невідома → «Qualification round 1», D18); `MATCHDAY_STAGES` — у `packages/types` (копія константи API). Сторінка матчу: ліга · сезон · стадія / тур · група; «← На головну» → `/?league=<ліга матчу>` | EC-фінал — «Фінал», а не «Тур 7»; повернення в контекст матчу |
| P5b-9 | Перемикач мови зберігає query (`?league=` не скидається): `window.location.search` у момент кліку, не `useSearchParams` | `Navbar` є на SSG-сторінках auth: `useSearchParams` без `Suspense` зламав би `next build` |

---

**Відоме, не робимо в 5b:**
- SSR невідомої ліги (`?league=NOPE`) — «Завантаження…», повідомлення «не знайдено» — після гідрації (помилку prefetch не гідруємо)
- Групові таблиці ЧС (з `Match.groupName`) і перемикач груп, сітка плей-оф — етап 7 (P5b-7)
- Назви турнірів / країн — англійською з провайдера (`CompetitionTranslation` — розділ 9)

---

#### Підсумок правил синку (старий основний план, етап 4.3)

**Cron:**
```
повний синк активних турнірів → @Cron('0 */2 * * *')  кожні 2 год (Competition.isActive, за sortOrder)
LIVE-синк                     → @Cron('*/5 * * * *')  кожні 5 хв, лише якщо FOOTBALL_LIVE_CRON_ENABLED=true
                                 і лише турніри з матчем у LIVE-вікні
вручну                        → POST /api/v1/football/sync  { competitionIds?: [наші slug-и] }
```

**Правила синку (переносити на кожну нову сутність — `Player`, `MatchEvent` тощо):**
- Повний синк турніру — **рівно 4 запити** (competition, teams, matches, standings); сезон фіксується з першого, відповідь про інший сезон → `FAILED`
- **Дельта:** `payloadHash` (SHA-256 нормалізованого `Provider*`) у `*ExternalRef`; без змін — жодного запису в доменну таблицю
- **Власність полів:** синк пише лише provider-owned поля; editorial (`slug`, `type`, `isActive`, `sortOrder`, переклади, прив'язки постів) — **ніколи**; `Club.slug` / `Season.label` — лише при створенні (вони в URL)
- **Без голого `upsert`** для спільних сутностей (Prisma 7 + driver adapter — не атомарний): `createMany skipDuplicates` + дочитування; клуб + ref — одна транзакція, P2002 → відкат і повторний resolve (P2002 вкладеного ref Prisma звітує як `modelName: "Club"`)
- **`Match` не видаляється** (каскад знищив би коментарі й лайки); `likeCount` / `dislikeCount` синк не пише; матчі — чанки по 50 в порядку `matchId`
- Таблиця — атомарно на `(seasonId, stage, groupName, type)` під `Season FOR NO KEY UPDATE`
- **Лок:** `SyncRun` `RUNNING` (partial unique) на provider + scope + турнір, `tryStart` під advisory-локом; застарілий (повний > 10 хв, LIVE > 3 хв) → `FAILED STALE`
- **LIVE:** вікно — гра йде або `SCHEDULED` у `[−3 год, +15 хв]`; LIVE-синк лише оновлює наявні матчі, `FINISHED` → оновити таблицю; не частіше 60 с на турнір

**football-data v4 — перевірено на реальних відповідях (Фаза 5.1):**
- `limit` / `offset` на матчах **ігноруються** — приходять усі матчі сезону одним запитом
- `score.fullTime` **містить** серію пенальті (маппер віднімає); `standings[].group` для ліг — підпис («Matchday», «League phase»), не група
- Standings: EC 2024 → **404** (= «таблиці немає», не збій); WC 2026 — одна таблиця `GROUP_STAGE` на 48 команд, групи — лише в `Match.groupName`; з `?season=` — `TOTAL` + `HOME` + `AWAY`
- `matchday` плей-оф: WC — `null`, EC — 4–7 → тури кубка групуємо за стадією; учасник до жеребкування — `homeTeam.id: null` (матч пропускається)
- Збірні ніяк не позначені — `NATIONAL` за турніром (WC, EC); `minute` — лише в LIVE; дати — UTC (конвертувати на фронті)

**Відоме, свідомо не зроблено (Фаза 5a):**
- Черга запитів до провайдера — на процес: кілька інстансів API ділять квоту ключа → спільний лімітер (етап 14)
- Повний і LIVE-синк одного турніру можуть іти одночасно (різні `scope`): повний може на секунди перезаписати свіжіший LIVE-рахунок — самовиправляється наступним синком
- `live-touch` шлеться раз на відкриття сторінки матчу → на проді увімкнути `FOOTBALL_LIVE_CRON_ENABLED` (етап 14)
- `SyncRun` росте (LIVE — до 60 запусків / год на турнір) → очищення старих запусків (бэклог)
