-- =============================================================================
-- МИНИ-CRM: СХЕМА БАЗЫ ДАННЫХ (PostgreSQL / SQLite совместимая)
-- =============================================================================

-- 1. Таблица администраторов и пользователей CRM
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Таблица лидов (заявок с сайта и CRM)
CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64),
  email VARCHAR(255),
  message TEXT,
  source_url VARCHAR(1024),
  source_name VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  amount NUMERIC NOT NULL DEFAULT 0,
  temperature VARCHAR(32) NOT NULL DEFAULT 'cold',
  manager VARCHAR(255) NOT NULL DEFAULT '',
  next_call_at TIMESTAMP,
  call_status VARCHAR(32) NOT NULL DEFAULT 'none',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notification_state VARCHAR(32) NOT NULL DEFAULT 'pending',
  external_idempotency_key VARCHAR(255) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(temperature);
CREATE INDEX IF NOT EXISTS idx_leads_manager ON leads(manager);
CREATE INDEX IF NOT EXISTS idx_leads_idempotency ON leads(external_idempotency_key);

-- 3. Таблица внутренних заметок и комментариев сотрудников
CREATE TABLE IF NOT EXISTS lead_comments (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id VARCHAR(64) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_lead_id ON lead_comments(lead_id);

-- 4. Очередь задач фоновых уведомлений (Email и Telegram)
CREATE TABLE IF NOT EXISTS notification_jobs (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_next ON notification_jobs(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_jobs_lead_id ON notification_jobs(lead_id);

-- 5. Журнал аудита действий пользователей (Audit Log)
CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  user_email VARCHAR(255),
  action VARCHAR(64) NOT NULL,
  details TEXT,
  ip_address VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at DESC);

-- 6. Динамические настройки интеграций и антиспама
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
