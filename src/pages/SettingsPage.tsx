import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { MaskedSettings, BackupMetadata } from '../types';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<MaskedSettings | null>(null);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  // Form editable states
  const [recipientEmail, setRecipientEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);

  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');

  const [siteApiKey, setSiteApiKey] = useState('');
  const [rateMax, setRateMax] = useState('20');
  const [rateWindow, setRateWindow] = useState('15');

  // Test status
  const [emailTesting, setEmailTesting] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);
  const [backupCreating, setBackupCreating] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [sRes, bRes] = await Promise.all([
        api.getSettings(),
        api.getBackups()
      ]);

      const s = sRes.settings;
      setSettings(s);
      setRecipientEmail(s.recipient_email || '');
      setSmtpHost(s.smtp_host || '');
      setSmtpPort(s.smtp_port || '465');
      setSmtpUser(s.smtp_user || '');
      setSmtpFrom(s.smtp_from || '');
      setSmtpSecure(s.smtp_secure ?? true);
      setTgChatId(s.telegram_chat_id || '');
      setRateMax(String(s.rate_limit_max_requests || 20));
      setRateWindow(String(s.rate_limit_window_minutes || 15));

      setBackups(bRes.backups || []);
    } catch (err: any) {
      setNotice({ type: 'danger', text: err.message || 'Ошибка загрузки настроек' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setNotice(null);

      const updates: any = {
        recipient_email: recipientEmail,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_from: smtpFrom,
        smtp_secure: smtpSecure,
        telegram_chat_id: tgChatId,
        rate_limit_max_requests: rateMax,
        rate_limit_window_minutes: rateWindow
      };

      if (smtpPass) updates.smtp_pass = smtpPass;
      if (tgToken) updates.telegram_bot_token = tgToken;
      if (siteApiKey) updates.site_api_key = siteApiKey;

      const res = await api.updateSettings(updates);
      setSettings(res.settings);
      setSmtpPass('');
      setTgToken('');
      setSiteApiKey('');
      setNotice({ type: 'success', text: '✓ Настройки успешно сохранены в базе данных!' });
    } catch (err: any) {
      setNotice({ type: 'danger', text: err.message || 'Ошибка сохранения настроек' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    try {
      setEmailTesting(true);
      setNotice(null);
      const res = await api.testEmail();
      if (res.success) {
        setNotice({ type: 'success', text: '✓ ' + res.message });
      } else {
        setNotice({ type: 'danger', text: 'Ошибка проверки SMTP: ' + res.message });
      }
    } catch (err: any) {
      setNotice({ type: 'danger', text: 'Ошибка: ' + err.message });
    } finally {
      setEmailTesting(false);
    }
  }

  async function handleTestTelegram() {
    try {
      setTgTesting(true);
      setNotice(null);
      const res = await api.testTelegram();
      if (res.success) {
        setNotice({ type: 'success', text: '✓ ' + res.message });
      } else {
        setNotice({ type: 'danger', text: 'Ошибка проверки Telegram: ' + res.message });
      }
    } catch (err: any) {
      setNotice({ type: 'danger', text: 'Ошибка: ' + err.message });
    } finally {
      setTgTesting(false);
    }
  }

  async function handleCreateBackup() {
    try {
      setBackupCreating(true);
      const res = await api.createBackup();
      alert(`Резервная копия создана: ${res.backup.filename} (${(res.backup.sizeBytes / 1024).toFixed(1)} КБ)`);
      const bRes = await api.getBackups();
      setBackups(bRes.backups || []);
    } catch (err: any) {
      alert(`Ошибка создания бэкапа: ${err.message}`);
    } finally {
      setBackupCreating(false);
    }
  }

  async function handleRestoreBackup(filename: string) {
    if (!window.confirm(`Вы уверены, что хотите восстановить базу данных из копии "${filename}"?`)) {
      return;
    }

    try {
      const res = await api.restoreBackup(filename);
      alert(res.message);
      loadAll();
    } catch (err: any) {
      alert(`Ошибка восстановления: ${err.message}`);
    }
  }

  if (loading && !settings) {
    return <div className="crm-page-container" style={{ padding: '60px', textAlign: 'center' }}>Загрузка настроек...</div>;
  }

  return (
    <div className="crm-page-container">
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-title">Настройки системы</h1>
          <p className="crm-page-subtitle">Интеграции, антиспам и резервное копирование</p>
        </div>
      </div>

      {notice && (
        <div className={`crm-alert crm-alert--${notice.type}`} style={{ marginBottom: '20px' }}>
          {notice.text}
        </div>
      )}

      <form onSubmit={handleSaveSettings}>
        {/* Section 1: Email Notifications */}
        <div className="crm-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 className="crm-card__title" style={{ margin: 0 }}>✉️ Email-уведомления (SMTP)</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--crm-muted)' }}>
                Отправка писем при поступлении новых заявок
              </p>
            </div>
            <button
              type="button"
              className="crm-btn crm-btn--sm crm-btn--secondary"
              onClick={handleTestEmail}
              disabled={emailTesting}
            >
              {emailTesting ? 'Проверка...' : 'Тест подключения'}
            </button>
          </div>

          <div className="crm-grid-2">
            <div className="crm-form-group">
              <label className="crm-label">Email получателя уведомлений</label>
              <input
                type="email"
                className="crm-input"
                placeholder="pk.market26@yandex.ru"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                required
              />
            </div>

            <div className="crm-form-group">
              <label className="crm-label">Email отправителя (From)</label>
              <input
                type="text"
                className="crm-input"
                placeholder="pk.market26@yandex.ru"
                value={smtpFrom}
                onChange={e => setSmtpFrom(e.target.value)}
              />
            </div>

            <div className="crm-form-group">
              <label className="crm-label">SMTP Сервер (Host)</label>
              <input
                type="text"
                className="crm-input"
                placeholder="smtp.yandex.ru или smtp.mail.ru"
                value={smtpHost}
                onChange={e => setSmtpHost(e.target.value)}
              />
            </div>

            <div className="crm-form-group">
              <label className="crm-label">SMTP Порт</label>
              <input
                type="text"
                className="crm-input"
                placeholder="465 (SSL) или 587 (STARTTLS)"
                value={smtpPort}
                onChange={e => setSmtpPort(e.target.value)}
              />
            </div>

            <div className="crm-form-group">
              <label className="crm-label">SMTP Логин (Пользователь)</label>
              <input
                type="text"
                className="crm-input"
                placeholder="pk.market26@yandex.ru"
                value={smtpUser}
                onChange={e => setSmtpUser(e.target.value)}
              />
            </div>

            <div className="crm-form-group">
              <label className="crm-label">
                Пароль приложения SMTP {settings?.smtp_pass_set && <span style={{ color: '#4ade80' }}>(✓ сохранён)</span>}
              </label>
              <input
                type="password"
                className="crm-input"
                placeholder={settings?.smtp_pass_set ? '•••••••••••• (оставьте пустым, чтобы не менять)' : 'Пароль приложения почты'}
                value={smtpPass}
                onChange={e => setSmtpPass(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Telegram Notifications */}
        <div className="crm-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 className="crm-card__title" style={{ margin: 0 }}>✈️ Telegram-уведомления</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--crm-muted)' }}>
                Мгновенные оповещения в Telegram-чат или канал
              </p>
            </div>
            <button
              type="button"
              className="crm-btn crm-btn--sm crm-btn--secondary"
              onClick={handleTestTelegram}
              disabled={tgTesting}
            >
              {tgTesting ? 'Отправка...' : 'Тест Telegram'}
            </button>
          </div>

          <div className="crm-grid-2">
            <div className="crm-form-group">
              <label className="crm-label">
                Telegram Bot Token {settings?.telegram_bot_token_set && <span style={{ color: '#4ade80' }}>(✓ сохранён: {settings.telegram_bot_token_preview})</span>}
              </label>
              <input
                type="password"
                className="crm-input"
                placeholder={settings?.telegram_bot_token_set ? '•••••••••••• (оставьте пустым, чтобы не менять)' : '123456789:ABCdef...'}
                value={tgToken}
                onChange={e => setTgToken(e.target.value)}
              />
              <span className="crm-hint">Получается у @BotFather в Telegram</span>
            </div>

            <div className="crm-form-group">
              <label className="crm-label">Telegram Chat ID</label>
              <input
                type="text"
                className="crm-input"
                placeholder="ID вашего чата или группы (например, 123456789 или -100123...)"
                value={tgChatId}
                onChange={e => setTgChatId(e.target.value)}
              />
              <span className="crm-hint">Узнать свой ID можно через @userinfobot</span>
            </div>
          </div>
        </div>

        {/* Section 3: Site API & Anti-spam */}
        <div className="crm-card" style={{ marginBottom: '24px' }}>
          <h2 className="crm-card__title" style={{ marginBottom: '16px' }}>🛡️ Ключ сайта и защита от спама</h2>

          <div className="crm-grid-2">
            <div className="crm-form-group">
              <label className="crm-label">
                Ключ доступа сайта (Site API Key) {settings?.site_api_key_set && <span style={{ color: '#4ade80' }}>(✓ сохранён: {settings.site_api_key_preview})</span>}
              </label>
              <input
                type="password"
                className="crm-input"
                placeholder={settings?.site_api_key_set ? '•••••••••••• (оставьте пустым, чтобы не менять)' : 'Секретная строка ключа'}
                value={siteApiKey}
                onChange={e => setSiteApiKey(e.target.value)}
              />
              <span className="crm-hint">Передается в заголовке X-Site-Key при отправке лида</span>
            </div>

            <div className="crm-form-group">
              <label className="crm-label">Лимит заявок с одного IP</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  className="crm-input"
                  style={{ width: '100px' }}
                  value={rateMax}
                  onChange={e => setRateMax(e.target.value)}
                />
                <span style={{ fontSize: '13px', color: 'var(--crm-muted)' }}>запросов за</span>
                <input
                  type="number"
                  className="crm-input"
                  style={{ width: '80px' }}
                  value={rateWindow}
                  onChange={e => setRateWindow(e.target.value)}
                />
                <span style={{ fontSize: '13px', color: 'var(--crm-muted)' }}>минут</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
          <button type="submit" className="crm-btn crm-btn--accent crm-btn--lg" disabled={saving}>
            {saving ? 'Сохранение...' : '💾 Сохранить настройки'}
          </button>
        </div>
      </form>

      {/* Section 4: Backup & Restore */}
      <div className="crm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 className="crm-card__title" style={{ margin: 0 }}>💾 Резервное копирование (Backups)</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--crm-muted)' }}>
              Статус: {settings?.backup_status || 'Готово'} • Последний архив: {settings?.last_backup_at ? new Date(settings.last_backup_at).toLocaleString('ru-RU') : 'Нет'}
            </p>
          </div>
          <button
            type="button"
            className="crm-btn crm-btn--accent"
            onClick={handleCreateBackup}
            disabled={backupCreating}
          >
            {backupCreating ? 'Создание...' : '+ Создать бэкап сейчас'}
          </button>
        </div>

        {backups.length === 0 ? (
          <div style={{ padding: '20px 0', color: 'var(--crm-muted)', fontSize: '13px' }}>
            Архивов пока нет. Нажмите «Создать бэкап сейчас».
          </div>
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Имя файла архива</th>
                  <th>Дата создания</th>
                  <th>Лидов в копии</th>
                  <th>Размер файла</th>
                  <th style={{ textAlign: 'right' }}>Действие</th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.filename}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{b.filename}</td>
                    <td>{new Date(b.createdAt).toLocaleString('ru-RU')}</td>
                    <td><strong>{b.leadsCount}</strong></td>
                    <td>{(b.sizeBytes / 1024).toFixed(1)} КБ</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="crm-btn crm-btn--xs crm-btn--danger-ghost"
                        onClick={() => handleRestoreBackup(b.filename)}
                      >
                        Восстановить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
