import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Lead } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { NotificationBadge } from '../components/NotificationBadge';

interface Props {
  onOpenLead: (leadId: string) => void;
}

export const LeadsPage: React.FC<Props> = ({ onOpenLead }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadLeads();
  }, [search, status, dateFrom, dateTo, sortOrder, page]);

  async function loadLeads() {
    try {
      setLoading(true);
      setError('');
      const res = await api.getLeads({
        page,
        limit: 20,
        search: search.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: 'created_at',
        sortOrder
      });

      setLeads(res.leads);
      setTotalPages(res.pagination.totalPages);
      setTotalLeads(res.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки списка заявок');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportCsv() {
    try {
      setExporting(true);
      const blob = await api.exportCsv({
        search: search.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Ошибка экспорта CSV: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setSearch('');
    setStatus('all');
    setDateFrom('');
    setDateTo('');
    setSortOrder('DESC');
    setPage(1);
  }

  return (
    <div className="crm-page-container">
      {/* Header */}
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-title">Список заявок ({totalLeads})</h1>
          <p className="crm-page-subtitle">Управление лидами, поиск и экспорт</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="crm-btn crm-btn--secondary"
            onClick={handleExportCsv}
            disabled={exporting}
            title="Экспорт в CSV с защитой от инъекций и UTF-8 BOM"
          >
            {exporting ? 'Экспорт...' : '📥 Экспорт в CSV'}
          </button>
          <button className="crm-btn crm-btn--accent" onClick={loadLeads}>
            🔄 Обновить
          </button>
        </div>
      </div>

      {error && <div className="crm-alert crm-alert--danger" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Toolbar / Filters Card */}
      <div className="crm-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="crm-toolbar">
          {/* Search Box */}
          <div style={{ flex: '1 1 260px' }}>
            <input
              type="text"
              className="crm-input"
              placeholder="🔍 Поиск по имени, телефону, email..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Status Filter Pills */}
          <div className="crm-filter-pills">
            {[
              { id: 'all', label: 'Все' },
              { id: 'new', label: 'Новые' },
              { id: 'in_progress', label: 'В работе' },
              { id: 'won', label: 'Успешно' },
              { id: 'lost', label: 'Отказы' }
            ].map(pill => (
              <button
                key={pill.id}
                className={`crm-pill-btn ${status === pill.id ? 'crm-pill-btn--active' : ''}`}
                onClick={() => {
                  setStatus(pill.id);
                  setPage(1);
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              className="crm-input"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              title="Дата от"
            />
            <span style={{ color: 'var(--crm-muted)' }}>—</span>
            <input
              type="date"
              className="crm-input"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              title="Дата до"
            />
          </div>

          {/* Reset Filters */}
          {(search || status !== 'all' || dateFrom || dateTo) && (
            <button className="crm-btn crm-btn--sm crm-btn--secondary" onClick={resetFilters}>
              Сброс
            </button>
          )}
        </div>
      </div>

      {/* Leads Content */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--crm-muted)' }}>
          Загрузка списка заявок...
        </div>
      ) : leads.length === 0 ? (
        <div className="crm-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
          <h3 style={{ fontSize: '18px', marginBottom: '6px' }}>Заявки не найдены</h3>
          <p style={{ color: 'var(--crm-muted)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 16px' }}>
            По заданным критериям фильтрации нет ни одной заявки. Попробуйте сбросить фильтры.
          </p>
          <button className="crm-btn crm-btn--accent" onClick={resetFilters}>
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="crm-card crm-desktop-only" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th style={{ width: '130px' }}>Дата</th>
                  <th>Клиент</th>
                  <th>Контакты</th>
                  <th>Источник</th>
                  <th style={{ width: '120px' }}>Статус</th>
                  <th style={{ width: '130px' }}>Уведомления</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Действие</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} onClick={() => onOpenLead(lead.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--crm-muted)' }}>
                      #{lead.id.replace('lead_', '').slice(0, 6)}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--crm-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(lead.created_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--crm-text)' }}>{lead.name}</strong>
                      {lead.message && (
                        <div style={{ fontSize: '12px', color: 'var(--crm-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                          {lead.message}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>
                        {lead.phone && <div style={{ fontWeight: 500 }}>{lead.phone}</div>}
                        {lead.email && <div style={{ fontSize: '12px', color: 'var(--crm-muted)' }}>{lead.email}</div>}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--crm-muted)' }}>
                        {lead.source_name || 'Сайт'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={lead.status} size="sm" />
                    </td>
                    <td>
                      <NotificationBadge state={lead.notification_state} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="crm-btn crm-btn--xs crm-btn--secondary" onClick={e => { e.stopPropagation(); onOpenLead(lead.id); }}>
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="crm-mobile-only crm-mobile-cards">
            {leads.map(lead => (
              <div key={lead.id} className="crm-lead-card-mobile" onClick={() => onOpenLead(lead.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--crm-muted)', fontFamily: 'monospace' }}>
                    #{lead.id.replace('lead_', '').slice(0, 6)} • {new Date(lead.created_at).toLocaleDateString('ru-RU')}
                  </span>
                  <StatusBadge status={lead.status} size="sm" />
                </div>

                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
                  {lead.name}
                </div>

                <div style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--crm-muted)' }}>
                  {lead.phone && <div>📞 {lead.phone}</div>}
                  {lead.email && <div>✉️ {lead.email}</div>}
                </div>

                {lead.message && (
                  <div style={{ fontSize: '13px', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                    {lead.message}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--crm-border)' }}>
                  <NotificationBadge state={lead.notification_state} />
                  <button className="crm-btn crm-btn--xs crm-btn--secondary">
                    Подробнее →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="crm-pagination">
              <button
                className="crm-btn crm-btn--sm crm-btn--secondary"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Назад
              </button>
              <span style={{ fontSize: '13px', color: 'var(--crm-muted)' }}>
                Страница {page} из {totalPages}
              </span>
              <button
                className="crm-btn crm-btn--sm crm-btn--secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Вперед →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
