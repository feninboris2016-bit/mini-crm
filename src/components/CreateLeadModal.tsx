import React, { useState } from 'react';
import { api } from '../api';
import { Lead } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: (lead: Lead) => void;
  managersList?: string[];
  sourcesList?: string[];
}

export const CreateLeadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onLeadCreated,
  managersList = ['Алексей', 'Дмитрий', 'Мария', 'Елена', 'Иван'],
  sourcesList = ['Сайт', 'Яндекс Директ', 'VK лид-форма', 'Telegram', 'WhatsApp', 'Звонок', 'Ручное добавление']
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [sourceName, setSourceName] = useState('Ручное добавление');
  const [status, setStatus] = useState('new');
  const [temperature, setTemperature] = useState('cold');
  const [manager, setManager] = useState('');
  const [message, setMessage] = useState('');
  const [nextCallAt, setNextCallAt] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Укажите имя клиента');
      return;
    }

    if (!phone.trim() && !email.trim()) {
      setError('Укажите телефон или email для связи');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.createLead({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim().toLowerCase() || null,
        amount: Number(amount) || 0,
        source_name: sourceName,
        status,
        temperature,
        manager: manager.trim(),
        message: message.trim() || null,
        next_call_at: nextCallAt ? new Date(nextCallAt).toISOString() : null
      });

      onLeadCreated(res.lead);
      onClose();
      // Reset fields
      setName('');
      setPhone('');
      setEmail('');
      setAmount('');
      setMessage('');
      setNextCallAt('');
    } catch (err: any) {
      setError(err.message || 'Ошибка создания заявки');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <h2 className="crm-modal-title">➕ Новая заявка / Лид</h2>
          <button className="crm-modal-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="crm-modal-body" style={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
            {error && <div className="crm-alert crm-alert--danger" style={{ marginBottom: '14px' }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {/* Name */}
              <div>
                <label className="crm-label">Имя клиента *</label>
                <input
                  type="text"
                  className="crm-input"
                  placeholder="Иван Петров"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="crm-label">Телефон</label>
                <input
                  type="tel"
                  className="crm-input"
                  placeholder="+7 (999) 000-00-00"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              {/* Email */}
              <div>
                <label className="crm-label">Email</label>
                <input
                  type="email"
                  className="crm-input"
                  placeholder="client@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="crm-label">Сумма сделки / Бюджет (₽)</label>
                <input
                  type="number"
                  className="crm-input"
                  placeholder="150000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>

              {/* Source */}
              <div>
                <label className="crm-label">Источник заявки</label>
                <select
                  className="crm-select"
                  value={sourceName}
                  onChange={e => setSourceName(e.target.value)}
                >
                  {sourcesList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Responsible Manager */}
              <div>
                <label className="crm-label">Ответственный менеджер</label>
                <select
                  className="crm-select"
                  value={manager}
                  onChange={e => setManager(e.target.value)}
                >
                  <option value="">Без назначения</option>
                  {managersList.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Stage / Status */}
              <div>
                <label className="crm-label">Начальный статус (колонка)</label>
                <select
                  className="crm-select"
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                >
                  <option value="new">🆕 Новый</option>
                  <option value="in_progress">⚙️ В работе</option>
                  <option value="negotiation">🤝 Переговоры</option>
                  <option value="won">🎉 Успешно завершён</option>
                  <option value="lost">❌ Отказ</option>
                </select>
              </div>

              {/* Temperature */}
              <div>
                <label className="crm-label">Температура лида</label>
                <select
                  className="crm-select"
                  value={temperature}
                  onChange={e => setTemperature(e.target.value)}
                >
                  <option value="cold">❄️ Холодный (первый контакт)</option>
                  <option value="attention">⚠️ Требует внимания (срочный)</option>
                  <option value="good">🌟 Тёплый / Готов покупать</option>
                </select>
              </div>

              {/* Next Callback Date */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="crm-label">Запланировать следующий контакт (перезвон)</label>
                <input
                  type="datetime-local"
                  className="crm-input"
                  value={nextCallAt}
                  onChange={e => setNextCallAt(e.target.value)}
                />
              </div>

              {/* Message / Notes */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="crm-label">Пожелания клиента / Комментарий</label>
                <textarea
                  className="crm-textarea"
                  rows={3}
                  placeholder="Интересует ПК TRISTAR PRIME, доставка по городу..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="crm-modal-footer">
            <button type="button" className="crm-btn crm-btn--ghost" onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className="crm-btn crm-btn--accent" disabled={submitting}>
              {submitting ? 'Создание...' : '✓ Создать заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
