import nodemailer from 'nodemailer';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { Lead } from '../repositories/leadsRepository.js';

export const emailService = {
  async getTransporter(): Promise<{ transporter: nodemailer.Transporter; from: string; recipient: string }> {
    const host = await settingsRepository.getValue('smtp_host', 'SMTP_HOST');
    const port = Number(await settingsRepository.getValue('smtp_port', 'SMTP_PORT')) || 465;
    const user = await settingsRepository.getValue('smtp_user', 'SMTP_USER');
    const pass = await settingsRepository.getValue('smtp_pass', 'SMTP_PASS');
    const from = (await settingsRepository.getValue('smtp_from', 'SMTP_FROM')) || user || 'noreply@crm.local';
    const recipient = (await settingsRepository.getValue('recipient_email', 'RECIPIENT_EMAIL')) || 'admin@crm.local';
    const secureVal = await settingsRepository.getValue('smtp_secure', 'SMTP_SECURE');
    const secure = secureVal === 'true' || secureVal === '1' || port === 465;

    if (!host || !user || !pass) {
      throw new Error('SMTP не настроен: укажите SMTP_HOST, SMTP_USER и SMTP_PASS в настройках CRM');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });

    return { transporter, from, recipient };
  },

  async sendLeadNotification(lead: Lead, appBaseUrl = 'http://localhost:3000'): Promise<{ messageId: string }> {
    const { transporter, from, recipient } = await this.getTransporter();

    const leadShortId = lead.id.replace('lead_', '').slice(0, 8).toUpperCase();
    const leadUrl = `${appBaseUrl}/#/leads/${lead.id}`;
    const subject = `🔔 Новая заявка #${leadShortId} от ${lead.name}`;

    const text = `
Новая заявка #${leadShortId}
==========================================
Имя: ${lead.name}
Телефон: ${lead.phone || 'Не указан'}
Email: ${lead.email || 'Не указан'}
Сообщение: ${lead.message || '—'}
Источник: ${lead.source_name || 'Сайт'} (${lead.source_url || '—'})
Дата: ${new Date(lead.created_at).toLocaleString('ru-RU')}

Открыть в CRM: ${leadUrl}
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f4f5f7; margin:0; padding:20px; color:#172b4d; }
    .card { max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08); border:1px solid #e2e8f0; }
    .header { background:#642ac4; color:#ffffff; padding:24px 28px; }
    .header h1 { margin:0; font-size:22px; font-weight:700; }
    .header p { margin:4px 0 0; opacity:0.85; font-size:14px; }
    .body { padding:28px; }
    .row { display:flex; margin-bottom:14px; border-bottom:1px solid #edf2f7; padding-bottom:12px; }
    .label { width:130px; color:#718096; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }
    .value { flex:1; font-size:15px; font-weight:500; color:#2d3748; }
    .message-box { background:#f7fafc; border-left:4px solid #642ac4; padding:14px 18px; border-radius:0 8px 8px 0; margin-top:16px; font-size:15px; line-height:1.5; color:#2d3748; }
    .footer { padding:20px 28px; background:#fafafa; border-top:1px solid #edf2f7; text-align:center; }
    .btn { display:inline-block; background:#642ac4; color:#ffffff !important; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Новая заявка #${leadShortId}</h1>
      <p>Поступила заявка с подключенного сайта</p>
    </div>
    <div class="body">
      <div class="row">
        <div class="label">Клиент:</div>
        <div class="value"><strong>${lead.name}</strong></div>
      </div>
      <div class="row">
        <div class="label">Телефон:</div>
        <div class="value">${lead.phone ? `<a href="tel:${lead.phone}" style="color:#642ac4; font-weight:600;">${lead.phone}</a>` : '—'}</div>
      </div>
      <div class="row">
        <div class="label">Email:</div>
        <div class="value">${lead.email ? `<a href="mailto:${lead.email}" style="color:#642ac4;">${lead.email}</a>` : '—'}</div>
      </div>
      <div class="row">
        <div class="label">Источник:</div>
        <div class="value">${lead.source_name || 'Сайт'} ${lead.source_url ? `(<a href="${lead.source_url}" target="_blank" style="color:#718096; font-size:13px;">ссылка</a>)` : ''}</div>
      </div>
      <div class="row">
        <div class="label">Дата и время:</div>
        <div class="value">${new Date(lead.created_at).toLocaleString('ru-RU')}</div>
      </div>
      ${lead.message ? `
        <div style="margin-top:18px;">
          <div class="label" style="margin-bottom:6px;">Сообщение клиента:</div>
          <div class="message-box">${lead.message}</div>
        </div>
      ` : ''}
    </div>
    <div class="footer">
      <a href="${leadUrl}" class="btn">Перейти в карточку лида</a>
    </div>
  </div>
</body>
</html>
    `.trim();

    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject,
      text,
      html
    });

    return { messageId: info.messageId };
  },

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { transporter } = await this.getTransporter();
      await transporter.verify();
      return { success: true, message: 'Подключение к SMTP-серверу успешно проверено' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Ошибка подключения к SMTP' };
    }
  }
};
