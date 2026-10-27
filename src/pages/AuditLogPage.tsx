import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { AuditEntry } from '../types';

export const AuditLogPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAudit();
  }, []);

  async function loadAudit() {
    try {
      setLoading(true);
      setError('');
      const res = await api.getAuditLogs(100);
      setEntries(res.entries || []);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки журнала аудита');
    } finally {
      setLoading(false);
    }
  }

  function formatAction(action: string): { label: string; color: string } {
    switch (action) {
      case 'login': return { label: 'Вход в систему', color: '#4ade80' };
      case 'status_change': return { label: 'Смена статуса лида', color: '#818cf8' };
      case 'comment_added': return { label: 'Добавлена заметка', color: '#fbbf24' };
      case 'export_csv': return { label: 'Экспорт в CSV', color: '#38bdf8' };
      case 'settings_updated': return { label: 'Настройки обновлены', color: '#c084fc' };
      case 'backup_created': return { label: 'Создан бэкап', color: '#34d399' };
      case 'backup_restored': return { label: 'Восстановление из бэкапа', color: '#f87171' };
      case 'lead_received': return { label: 'Получена новая заявка', color: '#a78bfa' };
      default: return { label: action, color: 'var(--crm-text)' };
    }
  }

  return (
    <div className="crm-page-container">
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-title">Журнал безопасности и аудита</h1>
          <p className="crm-page-subtitle">Фиксация критических действий пользователей и системы</p>
        </div>
        <button className="crm-btn crm-btn--sm crm-btn--secondary" onClick={loadAudit}>
          🔄 Обновить
        </button>
      </div>

      {error && <div className="crm-alert crm-alert--danger" style={{ marginBottom: '16px' }}>{error}</div>}

      <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--crm-muted)' }}>
            Загрузка записей журнала...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--crm-muted)' }}>
            Журнал пока пуст.
          </div>
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Дата и время</th>
                  <th style={{ width: '180px' }}>Действие</th>
                  <th>Пользователь / Источник</th>
                  <th>IP адрес</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const act = formatAction(e.action);
                  return (
                    <tr key={e.id}>
                      <td style={{ fontSize: '12px', color: 'var(--crm-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(e.created_at).toLocaleString('ru-RU')}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: act.color, fontSize: '13px' }}>
                          {act.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        {e.user_email ? <strong>{e.user_email}</strong> : <span style={{ color: 'var(--crm-muted)' }}>Система / API</span>}
                      </td>
                      <td style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--crm-muted)' }}>
                        {e.ip_address || '—'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--crm-muted)', fontFamily: 'monospace' }}>
                        {e.details || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
