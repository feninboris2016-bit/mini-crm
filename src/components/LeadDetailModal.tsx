import React, { useState, useEffect } from 'react';
import { Lead, LeadDetailsResponse } from '../types';
import { api } from '../api';
import { StatusBadge } from './StatusBadge';
import { NotificationBadge } from './NotificationBadge';

interface Props {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated: () => void;
  onLeadDeleted?: () => void;
  managersList?: string[];
}

export const LeadDetailModal: React.FC<Props> = ({
  leadId,
  onClose,
  onLeadUpdated,
  onLeadDeleted,
  managersList = ['Алексей', 'Дмитрий', 'Мария', 'Елена', 'Иван']
}) => {
  const [data, setData] = useState<LeadDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [updating, setUpdating] = useState(false);

  // Editable fields state
  const [amount, setAmount] = useState<number>(0);
  const [temperature, setTemperature] = useState<string>('cold');
  const [manager, setManager] = useState<string>('');
  const [nextCallAt, setNextCallAt] = useState<string>('');
  const [callStatus, setCallStatus] = useState<string>('none');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    loadDetails();
  }, [leadId]);

  async function loadDetails() {
    if (!leadId) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.getLeadDetails(leadId);
      setData(res);
      setAmount(res.lead.amount || 0);
      setTemperature(res.lead.temperature || 'cold');
      setManager(res.lead.manager || '');
      setNextCallAt(res.lead.next_call_at ? res.lead.next_call_at.slice(0, 16) : '');
      setCallStatus(res.lead.call_status || 'none');
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить карточку лида');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!data) return;
    try {
      setUpdating(true);
      await api.updateLeadStatus(data.lead.id, newStatus);
      setData({
        ...data,
        lead: { ...data.lead, status: newStatus as any }
      });
      onLeadUpdated();
    } catch (err: any) {
      alert(`Ошибка обновления статуса: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  }

  async function handleSaveDealFields() {
    if (!data) return;
    try {
      setUpdating(true);
      const res = await api.updateLead(data.lead.id, {
        amount: Number(amount) || 0,
        temperature,
        manager,
        next_call_at: nextCallAt ? new Date(nextCallAt).toISOString() : null,
        call_status: callStatus
      });
      setData({
        ...data,
        lead: res.lead
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onLeadUpdated();
    } catch (err: any) {
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteLead() {
    if (!data) return;
    if (!window.confirm(`Вы действительно хотите удалить заявку #${data.lead.id}? Это действие необратимо.`)) {
      return;
    }

    try {
      setUpdating(true);
      await api.deleteLead(data.lead.id);
      onClose();
      if (onLeadDeleted) onLeadDeleted();
      else onLeadUpdated();
    } catch (err: any) {
      alert(`Ошибка удаления: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !newComment.trim()) return;

    try {
      setCommentSubmitting(true);
      const res = await api.addComment(data.lead.id, newComment);
      setData({
        ...data,
        comments: [...data.comments, res.comment]
      });
      setNewComment('');
    } catch (err: any) {
      alert(`Ошибка добавления заметки: ${err.message}`);
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function handleRetryJob(jobId: string) {
    try {
      await api.retryJob(jobId);
      alert('Уведомление отправлено на повторную обработку');
      loadDetails();
      onLeadUpdated();
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(''), 2000);
  }

  function quickScheduleHours(hours: number) {
    const d = new Date(Date.now() + hours * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const str = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setNextCallAt(str);
    setCallStatus('callback');
  }

  if (!leadId) return null;

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-content" style={{ maxWidth: '840px' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="crm-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 className="crm-modal-title">
              Заявка #{leadId.replace('lead_', '').slice(0, 8).toUpperCase()}
            </h2>
            {data && <StatusBadge status={data.lead.status} />}

            {/* Temperature Badge */}
            {temperature === 'attention' && (
              <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                ⚠️ Требует внимания
              </span>
            )}
            {temperature === 'good' && (
              <span style={{ fontSize: '12px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                🌟 Тёплый лид
              </span>
            )}
            {temperature === 'cold' && (
              <span style={{ fontSize: '12px', background: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                ❄️ Холодный
              </span>
            )}
          </div>
          <button className="crm-modal-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="crm-modal-body" style={{ maxHeight: 'calc(88vh - 120px)', overflowY: 'auto' }}>
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Загрузка данных...</div>}

          {error && <div className="crm-alert crm-alert--danger">{error}</div>}

          {data && (
            <div className="crm-lead-details">
              {/* Quick Status Control Bar */}
              <div className="crm-status-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--crm-muted)', fontWeight: 500 }}>
                    Этап воронки:
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { key: 'new', label: '🆕 Новый' },
                      { key: 'in_progress', label: '⚙️ В работе' },
                      { key: 'negotiation', label: '🤝 Переговоры' },
                      { key: 'won', label: '🎉 Успешно' },
                      { key: 'lost', label: '❌ Отказ' }
                    ].map(st => (
                      <button
                        key={st.key}
                        className={`crm-status-btn ${data.lead.status === st.key ? 'crm-status-btn--active' : ''}`}
                        disabled={updating}
                        onClick={() => handleStatusChange(st.key)}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direct Phone Call Button */}
                {data.lead.phone && (
                  <a
                    href={`tel:${data.lead.phone}`}
                    className="crm-btn crm-btn--accent crm-btn--sm"
                    style={{ textDecoration: 'none' }}
                  >
                    📞 Позвонить
                  </a>
                )}
              </div>

              {/* Deal Parameters & Follow-up Card */}
              <div
                className="crm-card"
                style={{
                  marginBottom: '16px',
                  backgroundColor: 'rgba(31, 41, 55, 0.5)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 className="crm-card__title" style={{ margin: 0, color: '#c7d2fe' }}>
                    Параметры сделки и коммуникация
                  </h3>
                  {saveSuccess && (
                    <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>
                      ✓ Изменения сохранены
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {/* Amount / Budget */}
                  <div>
                    <label className="crm-label" style={{ fontSize: '12px' }}>Бюджет / Сумма сделки (₽)</label>
                    <input
                      type="number"
                      className="crm-input"
                      value={amount}
                      onChange={e => setAmount(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className="crm-label" style={{ fontSize: '12px' }}>Температура лида</label>
                    <select
                      className="crm-select"
                      value={temperature}
                      onChange={e => setTemperature(e.target.value)}
                    >
                      <option value="cold">❄️ Холодный</option>
                      <option value="attention">⚠️ Требует внимания</option>
                      <option value="good">🌟 Тёплый / Готов покупать</option>
                    </select>
                  </div>

                  {/* Responsible Manager */}
                  <div>
                    <label className="crm-label" style={{ fontSize: '12px' }}>Ответственный менеджер</label>
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

                  {/* Call Status */}
                  <div>
                    <label className="crm-label" style={{ fontSize: '12px' }}>Статус звонка</label>
                    <select
                      className="crm-select"
                      value={callStatus}
                      onChange={e => setCallStatus(e.target.value)}
                    >
                      <option value="none">Не звонили</option>
                      <option value="queued">В очереди на обзвон</option>
                      <option value="calling">Идёт вызов</option>
                      <option value="reached">Дозвонились</option>
                      <option value="noanswer">Не дозвонились</option>
                      <option value="callback">Нужен перезвон</option>
                      <option value="failed">Ошибка связи</option>
                    </select>
                  </div>
                </div>

                {/* Scheduled Callback */}
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <label className="crm-label" style={{ fontSize: '12px' }}>Следующий контакт (дата и время)</label>
                    <input
                      type="datetime-local"
                      className="crm-input"
                      value={nextCallAt}
                      onChange={e => setNextCallAt(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', marginTop: '18px' }}>
                    <button
                      type="button"
                      className="crm-btn crm-btn--xs crm-btn--secondary"
                      onClick={() => quickScheduleHours(2)}
                    >
                      +2 часа
                    </button>
                    <button
                      type="button"
                      className="crm-btn crm-btn--xs crm-btn--secondary"
                      onClick={() => quickScheduleHours(24)}
                    >
                      Завтра
                    </button>
                    <button
                      type="button"
                      className="crm-btn crm-btn--sm crm-btn--accent"
                      onClick={handleSaveDealFields}
                      disabled={updating}
                    >
                      {updating ? 'Сохранение...' : '💾 Сохранить параметры'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid: 2 Columns */}
              <div className="crm-lead-grid">
                {/* Left Column: Customer Details & Message */}
                <div>
                  <div className="crm-card" style={{ marginBottom: '16px' }}>
                    <h3 className="crm-card__title">Данные клиента</h3>
                    <div className="crm-prop-list">
                      <div className="crm-prop">
                        <span className="crm-prop__label">Имя:</span>
                        <span className="crm-prop__value" style={{ fontWeight: 600 }}>{data.lead.name}</span>
                      </div>

                      <div className="crm-prop">
                        <span className="crm-prop__label">Телефон:</span>
                        <div className="crm-prop__value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.lead.phone ? (
                            <>
                              <a href={`tel:${data.lead.phone}`} className="crm-link" style={{ fontWeight: 600 }}>
                                {data.lead.phone}
                              </a>
                              <button
                                className="crm-btn crm-btn--xs"
                                onClick={() => copyToClipboard(data.lead.phone!, 'phone')}
                                title="Копировать телефон"
                              >
                                {copiedField === 'phone' ? '✓ Скопировано' : 'Копировать'}
                              </button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--crm-muted)' }}>Не указан</span>
                          )}
                        </div>
                      </div>

                      <div className="crm-prop">
                        <span className="crm-prop__label">Email:</span>
                        <div className="crm-prop__value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.lead.email ? (
                            <>
                              <a href={`mailto:${data.lead.email}`} className="crm-link">
                                {data.lead.email}
                              </a>
                              <button
                                className="crm-btn crm-btn--xs"
                                onClick={() => copyToClipboard(data.lead.email!, 'email')}
                                title="Копировать email"
                              >
                                {copiedField === 'email' ? '✓ Скопировано' : 'Копировать'}
                              </button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--crm-muted)' }}>Не указан</span>
                          )}
                        </div>
                      </div>

                      <div className="crm-prop">
                        <span className="crm-prop__label">Источник:</span>
                        <span className="crm-prop__value">
                          {data.lead.source_name || 'Сайт'}
                          {data.lead.source_url && (
                            <span style={{ marginLeft: '6px' }}>
                              (<a href={data.lead.source_url} target="_blank" rel="noopener noreferrer" className="crm-link">
                                ссылка
                              </a>)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="crm-prop">
                        <span className="crm-prop__label">Поступила:</span>
                        <span className="crm-prop__value">
                          {new Date(data.lead.created_at).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="crm-card" style={{ marginBottom: '16px' }}>
                    <h3 className="crm-card__title">Содержание заявки / Запрос</h3>
                    {data.lead.message ? (
                      <div className="crm-lead-message" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {data.lead.message}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--crm-muted)', fontStyle: 'italic', fontSize: '14px' }}>
                        Клиент не оставил дополнительного комментария.
                      </div>
                    )}
                  </div>

                  {/* Delete Card */}
                  <div style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="crm-btn crm-btn--ghost"
                      style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      onClick={handleDeleteLead}
                      disabled={updating}
                    >
                      🗑️ Удалить карточку лида
                    </button>
                  </div>
                </div>

                {/* Right Column: Notifications & Comments */}
                <div>
                  {/* Notifications State Card */}
                  <div className="crm-card" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 className="crm-card__title" style={{ margin: 0 }}>Доставка уведомлений</h3>
                      <NotificationBadge state={data.lead.notification_state} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {data.jobs.map(job => (
                        <div key={job.id} className="crm-job-item">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {job.channel === 'email' ? '✉️ Email' : '✈️ Telegram'}
                            </span>
                            <span style={{ fontSize: '12px', color: job.status === 'sent' ? '#4ade80' : job.status === 'failed' ? '#f87171' : '#fbbf24' }}>
                              {job.status === 'sent' ? '✓ Отправлено' : job.status === 'failed' ? 'Ошибка' : `Попытка ${job.attempts}/${job.max_attempts}`}
                            </span>
                          </div>

                          {job.last_error && (
                            <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', background: 'rgba(239, 68, 68, 0.08)', padding: '4px 8px', borderRadius: '4px' }}>
                              {job.last_error}
                            </div>
                          )}

                          {job.status !== 'sent' && (
                            <div style={{ marginTop: '6px', textAlign: 'right' }}>
                              <button
                                className="crm-btn crm-btn--xs crm-btn--accent"
                                onClick={() => handleRetryJob(job.id)}
                              >
                                🔄 Отправить повторно
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Internal Notes / Comments */}
                  <div className="crm-card">
                    <h3 className="crm-card__title">Внутренние заметки сотрудников</h3>

                    {/* Existing Comments */}
                    <div className="crm-comments-list">
                      {data.comments.length === 0 ? (
                        <div style={{ color: 'var(--crm-muted)', fontSize: '13px', padding: '10px 0' }}>
                          Заметок пока нет. Напишите важные детали переговоров ниже.
                        </div>
                      ) : (
                        data.comments.map(c => (
                          <div key={c.id} className="crm-comment-item">
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--crm-muted)', marginBottom: '4px' }}>
                              <strong style={{ color: '#c4b5fd' }}>{c.author_name}</strong>
                              <span>{new Date(c.created_at).toLocaleString('ru-RU')}</span>
                            </div>
                            <div style={{ fontSize: '13px', lineHeight: 1.45 }}>{c.comment}</div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Comment Form */}
                    <form onSubmit={handleAddComment} style={{ marginTop: '12px' }}>
                      <textarea
                        className="crm-input"
                        rows={2}
                        placeholder="Добавить заметку о клиенте..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        style={{ resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                        <button
                          type="submit"
                          className="crm-btn crm-btn--sm crm-btn--accent"
                          disabled={!newComment.trim() || commentSubmitting}
                        >
                          {commentSubmitting ? 'Сохранение...' : 'Добавить заметку'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
