# 📚 Документация REST API (API.md)

Все эндпоинты системы версионированы и имеют префикс `/api/v1`.

---

## 1. Публичный API приёма заявок с сайта

### `POST /api/v1/leads`
Принимает входящие заявки с контактных форм подключенного сайта.

#### Заголовки:
- `Content-Type: application/json`
- `X-Site-Key: <SITE_API_KEY>` (обязателен, если задан в настройках CRM)
- `X-Idempotency-Key: <string>` (опционально, предотвращает дублирование при повторных отправках)

#### Тело запроса (JSON):
```json
{
  "name": "Иван Петров",
  "phone": "+7 (999) 123-45-67",
  "email": "ivan@example.com",
  "message": "Хочу заказать компьютер TRISTAR PRIME RTX 4070",
  "source_name": "Каталог товаров",
  "source_url": "https://example.com/catalog",
  "external_idempotency_key": "lead_1730000000_abc",
  "_hp_bio": ""
}
```

*Примечание:* Поле `_hp_bio` — скрытая ловушка (honeypot) для спам-ботов. Должно оставаться пустым.

#### Успешный ответ (HTTP 201 Created):
```json
{
  "success": true,
  "leadId": "lead_4f89d31a5bc2",
  "isDuplicate": false,
  "message": "Заявка успешно принята в обработку",
  "createdAt": "2026-10-27T11:20:00.000Z"
}
```

#### Ответ при повторной отправке с тем же ключом идемпотентности (HTTP 200 OK):
```json
{
  "success": true,
  "leadId": "lead_4f89d31a5bc2",
  "isDuplicate": true,
  "message": "Заявка уже была принята ранее",
  "createdAt": "2026-10-27T11:20:00.000Z"
}
```

#### Формат ошибок валидации (HTTP 400 Bad Request):
```json
{
  "error": "Ошибка валидации данных заявки",
  "code": "BAD_REQUEST",
  "validationErrors": {
    "contact": "Укажите контактные данные: телефон или email для связи"
  }
}
```

---

## 2. Авторизация (Auth API)

### `POST /api/v1/auth/login`
Вход администратора в систему.
- **Body**: `{ "email": "admin@crm.local", "password": "your_password" }`
- **Response**: `{ "success": true, "token": "jwt_...", "user": { ... } }`
- Также устанавливает защищённую httpOnly cookie `crm_token`.

### `POST /api/v1/auth/logout`
Выход из системы (очистка cookie).

### `GET /api/v1/auth/me`
Получение данных текущего авторизованного пользователя.

---

## 3. Административные маршруты заявок (Protected)

Все административные маршруты требуют заголовок `Authorization: Bearer <token>` или валидную cookie.

### `GET /api/v1/admin/leads/stats`
Возвращает общие агрегированные показатели для главного дашборда:
- `stats`: `{ total, new, in_progress, won, lost }`
- `queue`: `{ pending, processing, sent, retry, failed, total }`
- `recent`: массив последних 5 заявок.

### `GET /api/v1/admin/leads`
Список заявок с фильтрацией и пагинацией.
- **Параметры запроса (Query)**:
  - `page`: номер страницы (по умолчанию 1).
  - `limit`: количество на страницу (по умолчанию 20, максимум 100).
  - `search`: поиск по имени, телефону, email или тексту сообщения.
  - `status`: фильтр статуса (`new`, `in_progress`, `won`, `lost`).
  - `dateFrom`: фильтр по начальной дате (`YYYY-MM-DD`).
  - `dateTo`: фильтр по конечной дате (`YYYY-MM-DD`).
  - `sortBy`: поле сортировки (по умолчанию `created_at`).
  - `sortOrder`: направление сортировки (`DESC` или `ASC`).

### `GET /api/v1/admin/leads/:id`
Возвращает полную карточку заявки, включая:
- Данные лида (`lead`).
- Статусы задач уведомлений (`jobs`: Email и Telegram).
- Внутренние комментарии сотрудников (`comments`).

### `PATCH /api/v1/admin/leads/:id/status`
Изменение статуса лида.
- **Body**: `{ "status": "in_progress" }` (допустимы: `new`, `in_progress`, `won`, `lost`).
- Записывает событие в `audit_log`.

---

## 4. Заметки и комментарии (Comments API)

### `POST /api/v1/admin/leads/:id/comments`
Добавление внутренней служебной заметки менеджера к заявке.
- **Body**: `{ "comment": "Текст заметки" }`

### `GET /api/v1/admin/leads/:id/comments`
Получение списка всех заметок к лиду с указанием автора и времени.

---

## 5. Экспорт данных

### `GET /api/v1/admin/export/csv`
Формирует и отдает файл выгрузки в формате CSV.
- Поддерживает те же query-фильтры, что и список лидов (`search`, `status`, `dateFrom`, `dateTo`).
- Формирует поток с заголовком `Content-Disposition: attachment; filename="leads_export_YYYY-MM-DD.csv"`.
- Включает **UTF-8 BOM** для корректного отображения кириллицы в Excel.
- Экранирует опасные символы для защиты от CSV Formula Injection.

---

## 6. Настройки и интеграции

### `GET /api/v1/admin/settings`
Получение текущих настроек системы с маскированными секретами (`••••••••`).

### `POST /api/v1/admin/settings`
Обновление настроек SMTP, Telegram, ключа сайта и антиспам-лимитов.

### `POST /api/v1/admin/settings/test-email`
Тестовая проверка SMTP соединения с отправкой проверочного handshake.

### `POST /api/v1/admin/settings/test-telegram`
Тестовая проверка Telegram бота (вызов `getMe` и отправка тестового сообщения в `chat_id`).

---

## 7. Резервное копирование

### `GET /api/v1/admin/backups`
Список имеющихся снимков базы данных с датами и размерами.

### `POST /api/v1/admin/backups`
Создание нового снимка базы данных прямо сейчас.

### `POST /api/v1/admin/backups/restore`
Восстановление данных из указанного файла архива внутри транзакции.
- **Body**: `{ "filename": "backup-2026-10-27T11-12-50.json" }`

---

## 8. Очередь и внешние Cron вызовы

### `POST /api/v1/admin/jobs/:id/retry`
Ручной перезапуск задачи уведомления со статусом ошибки.

### `POST /api/v1/jobs/process-queue`
Эндпоинт для вызова воркера внешними планировщиками (cron-job.org, Vercel Cron, GitHub Actions).
- **Заголовок**: `X-Cron-Key: <CRON_SECRET>`
- Запускает обработку накопившихся или отложенных задач очереди.
