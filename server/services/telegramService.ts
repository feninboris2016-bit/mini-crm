import { settingsRepository } from '../repositories/settingsRepository.js';
import { Lead } from '../repositories/leadsRepository.js';

export const telegramService = {
  async getConfig(): Promise<{ token: string; chatId: string }> {
    const token = await settingsRepository.getValue('telegram_bot_token', 'TELEGRAM_BOT_TOKEN');
    const chatId = await settingsRepository.getValue('telegram_chat_id', 'TELEGRAM_CHAT_ID');

    if (!token || !chatId) {
      throw new Error('Telegram не настроен: укажите TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в настройках CRM');
    }

    return { token, chatId };
  },

  async sendLeadNotification(lead: Lead, appBaseUrl = 'http://localhost:3000'): Promise<{ messageId: number }> {
    const { token, chatId } = await this.getConfig();

    const leadShortId = lead.id.replace('lead_', '').slice(0, 8).toUpperCase();
    const leadUrl = `${appBaseUrl}/#/leads/${lead.id}`;
    const dateFormatted = new Date(lead.created_at).toLocaleString('ru-RU');

    let text = `🔥 <b>НОВАЯ ЗАЯВКА #${leadShortId}</b>\n\n`;
    text += `👤 <b>Клиент:</b> ${escapeHtml(lead.name)}\n`;
    if (lead.phone) {
      text += `📞 <b>Телефон:</b> <code>${escapeHtml(lead.phone)}</code>\n`;
    }
    if (lead.email) {
      text += `✉️ <b>Email:</b> ${escapeHtml(lead.email)}\n`;
    }
    text += `📍 <b>Источник:</b> ${escapeHtml(lead.source_name || 'Сайт')}\n`;
    text += `🕒 <b>Время:</b> ${dateFormatted}\n`;

    if (lead.message) {
      const truncatedMessage = lead.message.length > 400 ? lead.message.slice(0, 397) + '...' : lead.message;
      text += `\n💬 <b>Сообщение:</b>\n<i>${escapeHtml(truncatedMessage)}</i>\n`;
    }

    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '📂 Открыть в CRM',
              url: leadUrl
            }
          ]
        ]
      }
    };

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (err: any) {
      throw new Error(`Telegram API недоступен или тайм-аут: ${err.message || 'Network error'}`);
    } finally {
      clearTimeout(timeout);
    }

    const data: any = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      if (res.status === 429) {
        const retryAfter = data?.parameters?.retry_after || 60;
        throw new Error(`Telegram rate limit (429): повтор через ${retryAfter} сек`);
      }
      const desc = data?.description || `HTTP ${res.status}`;
      throw new Error(`Ошибка Telegram API: ${desc}`);
    }

    return { messageId: data.result.message_id };
  },

  async testConnection(): Promise<{ success: boolean; message: string; botUsername?: string }> {
    try {
      const { token, chatId } = await this.getConfig();
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data: any = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        return { success: false, message: data?.description || 'Неверный токен бота' };
      }

      // Also send a test message to verify chat ID
      const testMsgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ <b>Тестовое уведомление Мини-CRM</b>\nСвязь с Telegram ботом успешно настроена!',
          parse_mode: 'HTML'
        })
      });
      const testMsgData: any = await testMsgRes.json().catch(() => null);

      if (!testMsgRes.ok || !testMsgData?.ok) {
        return {
          success: false,
          message: `Бот найден (@${data.result.username}), но сообщение в chat_id "${chatId}" не доставлено: ${testMsgData?.description || 'Проверьте Chat ID и начните диалог с ботом (/start)'}`
        };
      }

      return {
        success: true,
        message: `Бот @${data.result.username} успешно проверен, тестовое сообщение доставлено!`,
        botUsername: data.result.username
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Ошибка подключения к Telegram' };
    }
  }
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
