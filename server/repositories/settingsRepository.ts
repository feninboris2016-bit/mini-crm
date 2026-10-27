import { db } from '../db/connection.js';

export interface MaskedSettings {
  recipient_email: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass_set: boolean;
  smtp_from: string;
  smtp_secure: boolean;
  telegram_bot_token_set: boolean;
  telegram_bot_token_preview: string;
  telegram_chat_id: string;
  site_api_key_set: boolean;
  site_api_key_preview: string;
  rate_limit_max_requests: number;
  rate_limit_window_minutes: number;
  backup_status: string;
  last_backup_at: string | null;
}

export const settingsRepository = {
  async getRaw(key: string): Promise<string | null> {
    const res = await db.queryOne<{ value: string }>('SELECT value FROM settings WHERE key = $1', [key]);
    return res ? res.value : null;
  },

  async getValue(key: string, envFallbackKey?: string): Promise<string> {
    const fromDb = await this.getRaw(key);
    if (fromDb !== null && fromDb !== undefined && fromDb !== '') {
      return fromDb;
    }
    if (envFallbackKey && process.env[envFallbackKey]) {
      return process.env[envFallbackKey]!;
    }
    return '';
  },

  async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    // Upsert key-value
    const existing = await this.getRaw(key);
    if (existing !== null) {
      await db.execute('UPDATE settings SET value = $1, updated_at = $2 WHERE key = $3', [value, now, key]);
    } else {
      await db.execute('INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3)', [key, value, now]);
    }
  },

  async setMany(entries: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      if (value !== undefined && value !== null) {
        await this.set(key, String(value));
      }
    }
  },

  async getMaskedSettings(): Promise<MaskedSettings> {
    const recipientEmail = await this.getValue('recipient_email', 'RECIPIENT_EMAIL');
    const smtpHost = await this.getValue('smtp_host', 'SMTP_HOST');
    const smtpPort = await this.getValue('smtp_port', 'SMTP_PORT') || '465';
    const smtpUser = await this.getValue('smtp_user', 'SMTP_USER');
    const smtpPass = await this.getValue('smtp_pass', 'SMTP_PASS');
    const smtpFrom = await this.getValue('smtp_from', 'SMTP_FROM');
    const smtpSecureVal = await this.getValue('smtp_secure', 'SMTP_SECURE');
    const smtpSecure = smtpSecureVal === 'true' || smtpSecureVal === '1' || smtpPort === '465';

    const tgToken = await this.getValue('telegram_bot_token', 'TELEGRAM_BOT_TOKEN');
    const tgChatId = await this.getValue('telegram_chat_id', 'TELEGRAM_CHAT_ID');

    const siteApiKey = await this.getValue('site_api_key', 'SITE_API_KEY');
    const rateMax = Number(await this.getValue('rate_limit_max_requests')) || 20;
    const rateWindow = Number(await this.getValue('rate_limit_window_minutes')) || 15;

    const lastBackup = await this.getRaw('last_backup_at');
    const backupStatus = await this.getRaw('backup_status') || 'Готово к архивации';

    // Mask sensitive keys
    const tgPreview = tgToken ? (tgToken.length > 8 ? `${tgToken.slice(0, 4)}••••${tgToken.slice(-4)}` : '••••••••') : '';
    const siteKeyPreview = siteApiKey ? (siteApiKey.length > 6 ? `${siteApiKey.slice(0, 4)}••••${siteApiKey.slice(-3)}` : '••••••••') : '';

    return {
      recipient_email: recipientEmail,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_user: smtpUser,
      smtp_pass_set: Boolean(smtpPass),
      smtp_from: smtpFrom,
      smtp_secure: smtpSecure,
      telegram_bot_token_set: Boolean(tgToken),
      telegram_bot_token_preview: tgPreview,
      telegram_chat_id: tgChatId,
      site_api_key_set: Boolean(siteApiKey),
      site_api_key_preview: siteKeyPreview,
      rate_limit_max_requests: rateMax,
      rate_limit_window_minutes: rateWindow,
      backup_status: backupStatus,
      last_backup_at: lastBackup
    };
  }
};
