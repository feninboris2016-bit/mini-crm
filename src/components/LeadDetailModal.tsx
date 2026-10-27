import React, { useState, useEffect } from 'react';
import { Lead, LeadDetailsResponse } from '../types';
import { api } from '../api';
import { StatusBadge } from './StatusBadge';
import { NotificationBadge } from './NotificationBadge';

interface Props {
  leadId: string | null;
  onClose: () => void;
  onLeadUpdated: () => void;
}

export const LeadDetailModal: React.FC<Props> = ({ leadId, onClose, onLeadUpdated }) => {
  const [data, setData] = useState<LeadDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);

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
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить карточку лида');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!data) return;
    try {
      setStatusUpdating(true);
      await api.updateLeadStatus(data.lead.id, newStatus);
      setData({
        ...data,
        lead: { ...data.lead, status: newStatus as any }
      });
      onLeadUpdated();
    } catch (err: any) {
      alert(`Ошибка обновления статуса: ${err.message}`);
    } finally {
      setStatusUpdating(false);
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

  if (!leadId) return null;

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="crm-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 className="crm-modal-title">
              Заявка #{leadId.replace('lead_', '').slice(0, 8).toUpperCase()}
            </h2>
            {data && <StatusBadge status={data.lead.status} />}
          </div>
          <button className="crm-modal-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="crm-modal-body">
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Загрузка данных...</div>}

          {error && <div className="crm-alert crm-alert--danger">{error}</div>}

          {data && (
            <div className="crm-lead-details">
              {/* Quick Status Control Bar */}
              <div className="crm-status-bar">
                <span style={{ fontSize: '13px', color: 'var(--crm-muted)', fontWeight: 500 }}>
                  Изменить статус:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(['new', 'in_progress', 'won', 'lost'] as const).map(st => (
                    <button
                      key={st}
                      className={`crm-status-btn ${data.lead.status === st ? 'crm-status-btn--active' : ''}`}
                      disabled={statusUpdating}
                      onClick={() => handleStatusChange(st)}
                    >
                      <StatusBadge status={st} size="sm" />
                    </button>
                  ))}
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
                    <h3 className="crm-card__title">Содержание заявки</h3>
                    {data.lead.message ? (
                      <div className="crm-lead-message">
                        {data.lead.message}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--crm-muted)', fontStyle: 'italic', fontSize: '14px' }}>
                        Клиент не оставил дополнительного комментария.
                      </div>
                    )}
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
