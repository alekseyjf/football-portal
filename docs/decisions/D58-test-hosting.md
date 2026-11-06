# D58 — Хостинг тест-сервера: Vercel (web, admin) + Render (API), деплой лише після зеленого CI

- **Статус:** ✅ прийнято · 2026-11-06 · 👤 рішення власника (OQ-7, перед стартом M1.10) + ⭐ деталі · ⏳ реалізація — M1.11
- **Етап:** M1.10 (назви перевірок CI), M1.11 (деплой), M3.1 (прод)
- **Уточнює:** [D31](D31-test-environment.md) — хостинг (було ❓ OQ-7; рекомендацію «API — Docker на інстансі, що не засинає» не прийнято); [D30](D30-testing-and-local-env.md) — Docker для деплою переїхав у M3; [OQ-8](../open-questions.md) (розділити dev і test БД) — відкладено; backend Rule 16 — expand → contract діє вже зараз

## Контекст
Тест-сервер має бути безкоштовним (👤 D31). В API є cron-и, що працюють у самому процесі: повний синк кожні 2 год ([D36](D36-sync-operations.md)), воркер розкладу новин щохвилини ([D57](D57-scheduled-publishing.md)), щогодинне прибирання безпеки. Тому процес не має засинати. БД — Supabase `eu-central-1` (Франкфурт), і нею ж користується локальна розробка.

## Рішення

### Де що працює
- 👤 web і admin — **Vercel Hobby**: два проєкти з одного репозиторію, Root Directory `apps/web` і `apps/admin`.
- 👤 API — **Render Free**, нативний Node без Docker. Конфіг сервісу лежить у репозиторії: `render.yaml` (Blueprint). Build Filters — `apps/api/**`, `packages/**`, `pnpm-lock.yaml`. ⭐ До них — кореневі `package.json`, `pnpm-workspace.yaml` і `.nvmrc`: вони теж змінюють збірку. Зміни самого `render.yaml` Render обробляє завжди. Версії Node і pnpm беруться з кореневого `package.json` (`engines`, `packageManager`).
- 👤 Регіон — той самий, що в Supabase: Render — `frankfurt` (після створення сервісу його не змінити), функції Vercel — `fra1` (на Hobby можна вибрати лише один регіон).
- ⭐ `rootDir` у Render не задаємо — *чому:* файлів поза ним Render не дає ні збірці, ні процесу, а API потрібні `packages/*`. Build filters рахуються від кореня репозиторію, тож `rootDir` для них не потрібен.

### Сон Render і cron
- Render Free засинає, якщо 15 хв не було вхідних запитів, і прокидається приблизно за хвилину. Поки процес спить, cron-и не виконуються.
- 👤 Workflow GitHub Actions за розкладом (`schedule`) кожні 10 хв звертається до `/api/v1/health`. Так процес не засинає (синк і воркер розкладу працюють), а SSR не чекає холодного старту. Платний інстанс — рішення в M3.1.
- ⭐ ⚠️ Деталі:
  - Render дає 750 безкоштовних годин на місяць на workspace. Сервіс, який не спить, витрачає ~744 год за 31 день, тож один влазить. Другий безкоштовний сервіс у тому ж workspace ділить ці години. Якщо вони закінчаться, Render зупинить усі безкоштовні сервіси до кінця місяця.
  - GitHub не гарантує часу запуску за розкладом, а на початку години затримує запуски найбільше. ⭐ Тому хвилини зі зсувом (`7,17,27,…`), а не `*/10`. ⭐ `curl` — з таймаутом ≥ 90 с і повтором: прокидання триває ~1 хв, і через нього запуск не має ставати червоним.
  - Workflow за розкладом запускається лише з `master`. У публічному репозиторії GitHub вимикає його після 60 днів без активності.
  - `/health` перевіряє й БД ([D33](D33-observability.md)): заодно безкоштовна Supabase не засне після тижня без запитів.
  - Uptime-монітор (M1.11.8) — ще один пінг; він страхує від пропущених запусків.
  - Render може перезапустити безкоштовний сервіс будь-коли. Тому graceful shutdown (M1.11.7, D36) тут важливіший, ніж на звичайному інстансі.
- Розглядали cron у GitHub Actions, що викликає захищений ендпоінт синку (рекомендація OQ-7 для варіанта «строго $0»). Відмовились: пінг тримає весь процес — і воркер розкладу, і прибирання, — і не потребує нового ендпоінта з секретом.

### Деплой лише після зеленого CI
- 👤 Render — Auto-Deploy «After CI Checks Pass» (`autoDeployTrigger: checksPass` у `render.yaml`; старе `autoDeploy` застаріло). Деплой починається, лише коли **всі** перевірки коміту в `master` мають результат `success`, `neutral` або `skipped`. Якщо на коміті немає жодної перевірки, деплою не буде.
- 👤 Vercel — **Deployment Checks** (Settings → Build and Deployment → Deployment Checks → Add Checks → GitHub → `verify`, `e2e-api`). Збірка стартує одразу, але production-домен Vercel призначає лише після зелених перевірок. Обійти перевірки — Force Promote на сторінці деплою. Умова — автоматичне призначення production-домену (auto-aliasing) має бути ввімкнене.
  - Перевірено 2026-11-06 (👤 просив перевірити Hobby). Сторінка документації тарифів не називає. Changelog Vercel пише, що перевірки з GitHub Actions доступні «всім проєктам, підключеним до GitHub», а native-перевірки — «кожній команді». Отже, на Hobby вони є. ⭐ Підтвердити в налаштуваннях на старті M1.11.2.
- Наслідки для CI (M1.10):
  - назви job-ів `verify` і `e2e-api` — **стабільні**, бо Vercel шукає перевірку за назвою job-а, а на ці ж назви посилається ruleset `master`;
  - workflow — без фільтрів `paths` / `paths-ignore`: перевірки мають бути на кожному коміті. Інакше Render не задеплоїть, а обов'язкова перевірка, що не запустилась, назавжди заблокує злиття PR.

### БД
- 👤 Тест-сервер і локальна розробка поки працюють з однією Supabase. Розділення (OQ-8) відкладено.
- 👤 Правила діють одразу, не «після першого деплою»:
  - на цій БД ніколи не запускаємо `prisma migrate dev` (і `migrate reset`) — лише `migrate deploy`;
  - нові міграції — з `--create-only`;
  - expand → contract (backend Rule 16);
  - `pg_dump` перед кожною міграцією.
- 👤 Міграції застосовуються з локальної машини (`pnpm db:migrate` через `DIRECT_URL`). Окремого кроку міграцій у релізі тесту немає. Pre-deploy команди Render Free однаково не має.
- ⭐ Порядок кроків: expand-міграцію застосовуємо до злиття PR з кодом, якому вона потрібна. Contract — коли на тесті вже працює код, що старого не використовує. *Чому:* міграція діє на тест-сервер одразу, а код потрапляє туди лише після злиття й CI.
- ⭐ «`--create-only`» означає: міграцію генеруємо й читаємо SQL, а не застосовуємо одразу. Сам `migrate dev --create-only` — це той самий `migrate dev`: він працює з БД з `prisma.config.ts` (тобто зі спільною) і з тіньовою БД, а коли бачить розбіжності, пропонує скинути схему. Тому генеруємо так, як уже робили 0006–0012: `prisma migrate diff --from-schema <schema.prisma з master> --to-schema prisma/schema.prisma --script` — команда до БД не звертається. 👤 2026-11-06 — одна команда з кореня: `pnpm db:migration:new <назва>` (`apps/api/scripts/new-migration.mjs`). Базою вона бере схему, з якої почалась гілка (`git merge-base HEAD origin/master`), пише `prisma/migrations/<NNNN>_<назва>/migration.sql` і відмовляє, якщо схема не змінилась або в гілці вже є незакомічена міграція — її SQL повторився б.
- 👤 Підключення: `DATABASE_URL` — transaction pooler (`:6543`, `pgbouncer=true`); `DIRECT_URL` — session pooler (`:5432`) для міграцій.
  - Перевірено 2026-11-06: у Prisma 7 поля `directUrl` немає ні в `schema.prisma`, ні в `prisma.config.ts` (у `datasource` конфігу — лише `url` і `shadowDatabaseUrl`). Те саме вже зроблено інакше: CLI бере `url: process.env.DIRECT_URL || env("DATABASE_URL")` (`prisma.config.ts`), а застосунок — `PrismaPg(env.DATABASE_URL)`; `DIRECT_URL` застосунок не читає. Тож на Render потрібна лише `DATABASE_URL`.
  - `pgbouncer=true` для `PrismaPg` нічого не змінює: адаптер дає prepared statements ім'я лише з `statementNameGenerator`, тож transaction pooler працює і без прапорця. Прапорець лишаємо — він не шкодить.
  - ⚠️ На `:6543` уже ловили зависання ([OQ-11](../open-questions.md): запит висить 12–15 хв на «мертвому» сокеті). На тесті це виглядатиме як сторінки, що не відкриваються. ⭐ Якщо таке з'явиться — переключити `DATABASE_URL` на session pooler (`:5432`): зміна однієї змінної, без коду. Для сервера, що працює постійно (не serverless), Supabase радить саме його, а transaction pooler — для serverless.

### Docker і прод
- 👤 Docker (був M1.11.2) — у M3.1: Render і Vercel образу не потребують.
- 👤 Vercel Hobby — лише для некомерційного використання (з документації: «the Hobby plan restricts users to non-commercial, personal use only»). Для проду — Vercel Pro або інший хостинг (M3.1).

## Наслідки
- Обмеження Hobby, які стосуються тесту:
  - оптимізація фото — 5 000 перетворень на місяць; понад ліміт нові фото не оптимізуються (відповідь 402), платити не треба;
  - Password Protection є лише на Pro, тож Basic Auth тест-сервера (M1.11.6) робимо в `proxy.ts` web і admin;
  - Hobby-проєкт не підключається до репозиторію організації GitHub (наш репозиторій — особистий).
- Обмеження Render Free: немає shell, немає диска (файли зникають при рестарті), немає pre-deploy команди, відкат — лише до двох попередніх деплоїв, вихідна пошта (порти 25 / 465 / 587) заблокована. Пошту (M3.3) тому надсилатимемо через HTTP API провайдера.
- Vercel передає заголовок `x-vercel-ip-timezone`, тож пояс першого візиту (M2.12) можна брати з нього.
- ⚠️ `engines.node` у кореневому `package.json` — `>=24.18.0`, без верхньої межі. Render бере `.nvmrc` (24.18.0; файл має вищий пріоритет за `engines`). Vercel бере основну версію з `engines`, і з `>=` перейде на нову основну версію Node, щойно вона вийде. ⭐ Змінити на `^24.18.0` (M1.11.2).

## Розглянуті альтернативи
- API на Railway або Fly.io (~$2–5 на місяць, без сну, Docker) — платно; повернемось до них у M3.1.
- API на Render у Docker-образі — без потреби: нативний Node на Render збирає pnpm workspace сам.
- Google Cloud Run (масштабується до нуля, cron через Cloud Scheduler) або Oracle Cloud Always Free (VM, що адмініструєш сам) — складніше для першого деплою.

## Джерела (перевірено 2026-11-06)
- Render: [Blueprint spec](https://render.com/docs/blueprint-spec) (`autoDeployTrigger`, `buildFilter`, `region`), [Deploys](https://render.com/docs/deploys) («After CI Checks Pass»), [Free](https://render.com/docs/free) (сон, 750 год, обмеження), [Node version](https://render.com/docs/node-version), [Monorepo](https://render.com/docs/monorepo-support).
- Vercel: [Deployment Checks](https://vercel.com/docs/deployment-checks), changelog [Block deployment promotions with GitHub Actions](https://vercel.com/changelog/block-vercel-deployment-promotions-with-github-actions) і [Native Deployment Checks](https://vercel.com/changelog/native-deployment-checks), [Hobby](https://vercel.com/docs/plans/hobby), [Function regions](https://vercel.com/docs/functions/configuring-functions/region), [Image Optimization limits](https://vercel.com/docs/image-optimization/limits-and-pricing), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
