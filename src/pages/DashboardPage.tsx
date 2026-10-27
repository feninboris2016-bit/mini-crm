import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { DashboardStats, Lead } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { NotificationBadge } from '../components/NotificationBadge';

interface Props {
  onOpenLead: (leadId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<Props> = ({ onOpenLead, onNavigateTab }) => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
    // Auto refresh every 30s
    const timer = setInterval(loadStats, 30000);
    return () => clearInterval(timer);
  }, []);

  async function loadStats() {
    try {
      const res = await api.getDashboardStats();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки статистики');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return <div className="crm-page-container" style={{ textAlign: 'center', padding: '60px' }}>Загрузка показателей...</div>;
  }

  const stats = data?.stats || { total: 0, new: 0, in_progress: 0, won: 0, lost: 0 };
  const queue = data?.queue || { pending: 0, processing: 0, sent: 0, retry: 0, failed: 0, total: 0 };
  const recent = data?.recent || [];

  return (
    <div className="crm-page-container">
      {/* Page Title */}
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-title">Сводка и показатели</h1>
          <p className="crm-page-subtitle">Обзор поступающих заявок с подключенного сайта</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="crm-btn crm-btn--sm crm-btn--secondary" onClick={loadStats}>
            🔄 Обновить
          </button>
          <button className="crm-btn crm-btn--sm crm-btn--accent" onClick={() => onNavigateTab('leads')}>
            Все заявки →
          </button>
        </div>
      </div>

      {error && <div className="crm-alert crm-alert--danger" style={{ marginBottom: '20px' }}>{error}</div>}

      {/* Metrics Row */}
      <div className="crm-stats-grid">
        <div className="crm-stat-card" onClick={() => onNavigateTab('leads')}>
          <div className="crm-stat-card__label">Всего заявок</div>
          <div className="crm-stat-card__value">{stats.total}</div>
          <div className="crm-stat-card__hint">За все время работы</div>
        </div>

        <div className="crm-stat-card crm-stat-card--accent" onClick={() => onNavigateTab('leads')}>
          <div className="crm-stat-card__label" style={{ color: '#818cf8' }}>Новые заявки</div>
          <div className="crm-stat-card__value" style={{ color: '#818cf8' }}>{stats.new}</div>
          <div className="crm-stat-card__hint">Требуют первичного контакта</div>
        </div>

        <div className="crm-stat-card" onClick={() => onNavigateTab('leads')}>
          <div className="crm-stat-card__label" style={{ color: '#fbbf24' }}>В работе</div>
          <div className="crm-stat-card__value" style={{ color: '#fbbf24' }}>{stats.in_progress}</div>
          <div className="crm-stat-card__hint">Ведутся переговоры</div>
        </div>

        <div className="crm-stat-card" onClick={() => onNavigateTab('leads')}>
          <div className="crm-stat-card__label" style={{ color: '#4ade80' }}>Успешно завершены</div>
          <div className="crm-stat-card__value" style={{ color: '#4ade80' }}>{stats.won}</div>
          <div className="crm-stat-card__hint">Сделка закрыта / оплачена</div>
        </div>

        <div className="crm-stat-card" onClick={() => onNavigateTab('leads')}>
          <div className="crm-stat-card__label" style={{ color: '#f87171' }}>Отказы</div>
          <div className="crm-stat-card__value" style={{ color: '#f87171' }}>{stats.lost}</div>
          <div className="crm-stat-card__hint">Нецелевые / отмененные</div>
        </div>
      </div>

      {/* Secondary Layout: Queue & Recent Leads */}
      <div className="crm-two-col">
        {/* Left: Recent Leads */}
        <div className="crm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="crm-card__title" style={{ margin: 0 }}>Последние поступившие заявки</h2>
            <button className="crm-link" onClick={() => onNavigateTab('leads')} style={{ fontSize: '13px' }}>
              Смотреть все ({stats.total})
            </button>
          </div>

          {recent.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--crm-muted)' }}>
              Заявок пока нет. Подключите форму сайта, чтобы начать принимать лиды.
            </div>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Контакты</th>
                    <th>Источник</th>
                    <th>Статус</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((lead: Lead) => (
                    <tr key={lead.id} onClick={() => onOpenLead(lead.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <strong>{lead.name}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px' }}>{lead.phone || lead.email || '—'}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--crm-muted)' }}>
                          {lead.source_name || 'Сайт'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={lead.status} size="sm" />
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--crm-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(lead.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Integration & Queue Status Card */}
        <div className="crm-card">
          <h2 className="crm-card__title" style={{ marginBottom: '16px' }}>Очередь уведомлений</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="crm-queue-stat-item">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                Успешно доставлено
              </span>
              <strong style={{ color: '#4ade80' }}>{queue.sent}</strong>
            </div>

            <div className="crm-queue-stat-item">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }} />
                В очереди / повторная попытка
              </span>
              <strong style={{ color: '#fbbf24' }}>{queue.pending + queue.retry + queue.processing}</strong>
            </div>

            <div className="crm-queue-stat-item">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f87171' }} />
                Ошибки доставки
              </span>
              <strong style={{ color: queue.failed > 0 ? '#f87171' : 'var(--crm-muted)' }}>{queue.failed}</strong>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--crm-border)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Интеграции</h3>
            <div style={{ fontSize: '13px', color: 'var(--crm-muted)', lineHeight: 1.6 }}>
              <div>✉️ <strong>Email:</strong> SMTP очереди с экспоненциальной задержкой</div>
              <div>✈️ <strong>Telegram:</strong> официальный Telegram Bot API</div>
              <div>🛡️ <strong>Антиспам:</strong> Honeypot + Rate Limiting</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
