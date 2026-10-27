# 🚀 Руководство по развёртыванию (DEPLOYMENT.md)

В данном руководстве описаны варианты бесплатного и производственного развёртывания Мини-CRM.

---

## 1. Рекомендуемый стек для бесплатного размещения

| Компонент | Сервис | Тариф | Ограничения и особенности |
| :--- | :--- | :--- | :--- |
| **База данных** | **Neon.tech** | Free Tier | Полноценный **PostgreSQL 16**, 0.5 ГБ постоянного хранилища, SSL, пулинг соединений. Не удаляется со временем. |
| **Сервер + UI** | **Render.com** | Free Web Service | 512 МБ RAM, авто-SSL. Засыпает через 15 минут неактивности, просыпается при запросе (~40 сек). |
| **Фоновый Cron** | **cron-job.org** | Free | Бесплатный вызов `POST /api/v1/jobs/process-queue` каждые 5-10 минут для поддержания очереди и предотвращения сна. |

---

## 2. Пошаговая инструкция развёртывания (Render + Neon)

### Шаг 1: Создание бесплатной базы данных PostgreSQL в Neon
1. Зарегистрируйтесь на сайте **[neon.tech](https://neon.tech/)** (вход через GitHub / Google).
2. Создайте новый проект (например, `mini-crm-db`).
3. Скопируйте строку подключения **Connection Details** (вида `postgres://user:password@ep-xyz.neon.tech/neondb?sslmode=require`).

### Шаг 2: Создание Web Service на Render.com
1. Зарегистрируйтесь на **[render.com](https://render.com/)**.
2. Создайте **New Web Service** и подключите репозиторий с проектом.
3. Укажите параметры сборки:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. В разделе **Environment Variables** добавьте:
   - `DATABASE_URL`: ваша строка из Neon (`postgres://...`)
   - `JWT_SECRET`: сгенерированная случайная строка (минимум 32 символа)
   - `ALLOWED_ORIGIN`: домен вашего сайта (например, `https://tristar-prime.netlify.app` или `*`)
   - `SITE_API_KEY`: секретный ключ сайта (например, `crm_secret_key_2026`)
   - `CRON_SECRET`: секретный токен для внешнего cron (например, `cron_token_12345`)
   - `NODE_ENV`: `production`
5. Нажмите **Create Web Service**. Render автоматически соберет React-клиент и запустит Express-сервер.

### Шаг 3: Создание первого администратора
В панели Render перейдите во вкладку **Shell** и выполните:
```bash
npm run create-admin -- admin@yourdomain.com your_strong_password_123
```
Теперь вы можете открыть выданный URL (например, `https://mini-crm.onrender.com`) и войти в систему.

### Шаг 4: Настройка периодического вызова очереди (Cron)
Так как бесплатный тариф Render засыпает через 15 минут бездействия:
1. Зарегистрируйтесь на бесплатном сервисе **[cron-job.org](https://cron-job.org/)**.
2. Создайте задачу с расписанием раз в 5–10 минут:
   - **URL**: `https://your-crm.onrender.com/api/v1/jobs/process-queue`
   - **Method**: `POST`
   - **Headers**: `X-Cron-Key: ваш_CRON_SECRET`
3. Это гарантирует своевременную отправку повторных уведомлений и держит сервер готовым к приёму заявок без задержек холодного старта.

---

## 3. Развёртывание в Docker (VPS / Собственный сервер)

Для запуска на любом виртуальном сервере (Ubuntu, Debian, CentOS) в проекте подготовлен `Dockerfile`:

```bash
# 1. Клонирование и настройка
git clone <ваш_репозиторий>
cd mini-crm
cp .env.example .env
# Отредактируйте .env

# 2. Сборка Docker-образа
docker build -t mini-crm .

# 3. Запуск контейнера
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  --name mini-crm-app \
  --restart unless-stopped \
  mini-crm
```
Папка `/app/data` монтируется на диск хоста, что обеспечивает полную сохранность базы данных SQLite (при автономном режиме) и создаваемых резервных копий.
