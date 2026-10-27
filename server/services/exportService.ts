import { leadsRepository, Lead, LeadFilterOptions } from '../repositories/leadsRepository.js';

export const exportService = {
  sanitizeForCsv(value: any): string {
    if (value === null || value === undefined) return '';
    let str = String(value);

    // Protection against CSV Formula Injection (CWE-1236)
    // If field starts with =, +, -, @, \t, \r, prepend single quote
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }

    // Escape double quotes by doubling them
    const escaped = str.replace(/"/g, '""');

    // If string contains comma, quote, or newline, wrap in quotes
    if (/[",\r\n]/.test(escaped)) {
      return `"${escaped}"`;
    }

    return escaped;
  },

  getStatusLabel(status: string): string {
    switch (status) {
      case 'new': return 'Новая';
      case 'in_progress': return 'В работе';
      case 'won': return 'Успешно';
      case 'lost': return 'Отказ';
      default: return status;
    }
  },

  getNotificationLabel(state: string): string {
    switch (state) {
      case 'sent': return 'Отправлено';
      case 'partial': return 'Частично';
      case 'failed': return 'Ошибка';
      case 'pending': return 'Ожидает';
      default: return state;
    }
  },

  async generateLeadsCsv(options: LeadFilterOptions = {}): Promise<string> {
    // Fetch all matching leads without pagination limit
    const leads = await leadsRepository.findMany({
      ...options,
      limit: 10000,
      offset: 0
    });

    const headers = [
      'ID заявки',
      'Дата и время',
      'Статус',
      'Имя клиента',
      'Телефон',
      'Email',
      'Сообщение / пожелания',
      'Название источника',
      'URL страницы',
      'Статус уведомлений'
    ];

    const rows: string[] = [];
    rows.push(headers.map(h => this.sanitizeForCsv(h)).join(';'));

    for (const lead of leads) {
      const row = [
        lead.id,
        new Date(lead.created_at).toLocaleString('ru-RU'),
        this.getStatusLabel(lead.status),
        lead.name,
        lead.phone || '',
        lead.email || '',
        lead.message || '',
        lead.source_name || '',
        lead.source_url || '',
        this.getNotificationLabel(lead.notification_state)
      ];
      rows.push(row.map(c => this.sanitizeForCsv(c)).join(';'));
    }

    // Prepend UTF-8 BOM so Microsoft Excel opens Russian text without encoding errors
    const bom = '\uFEFF';
    return bom + rows.join('\r\n');
  }
};
