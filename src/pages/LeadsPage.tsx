import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Lead } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { NotificationBadge } from '../components/NotificationBadge';
import { KanbanBoard } from '../components/KanbanBoard';
import { FilterBar } from '../components/FilterBar';
import { CreateLeadModal } from '../components/CreateLeadModal';

interface Props {
  onOpenLead: (leadId: string) => void;
}

export const LeadsPage: React.FC<Props> = ({ onOpenLead }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // View Mode: 'kanban' or 'table'
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [temperature, setTemperature] = useState('all');
  const [manager, setManager] = useState('all');
  const [source, setSource] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);

  const [exporting, setExporting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    loadLeads();
  }, [search, status, temperature, manager, source, dateFrom, dateTo, sortOrder, page, viewMode]);

  async function loadLeads() {
    try {
      setLoading(true);
      setError('');
      // In Kanban view, load up to 100 leads to give full overview of pipeline columns
      const limit = viewMode === 'kanban' ? 100 : 25;

      const res = await api.getLeads({
        page,
        limit,
        search: search.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        temperature: temperature !== 'all' ? temperature : undefined,
        manager: manager !== 'all' ? manager : undefined,
        source: source !== 'all' ? source : undefined,
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

  async function handleMoveLead(leadId: string, toStatus: string) {
    try {
      // Optimistic update
      setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, status: toStatus } : l)));
      await api.updateLeadStatus(leadId, toStatus);
    } catch (err: any) {
      alert(`Ошибка перемещения лида: ${err.message}`);
      loadLeads();
    }
  }

  async function handleUpdateTemperature(leadId: string, nextTemp: string) {
    try {
      // Optimistic update
      setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, temperature: nextTemp } : l)));
      await api.updateLead(leadId, { temperature: nextTemp });
    } catch (err: any) {
      alert(`Ошибка обновления температуры: ${err.message}`);
      loadLeads();
    }
  }

  async function handleAssignManager(leadId: string, newManager: string) {
    try {
      // Optimistic update
      setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, manager: newManager } : l)));
      await api.updateLead(leadId, { manager: newManager });
    } catch (err: any) {
      alert(`Ошибка назначения менеджера: ${err.message}`);
      loadLeads();
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
    setTemperature('all');
    setManager('all');
    setSource('all');
    setDateFrom('');
    setDateTo('');
    setSortOrder('DESC');
    setPage(1);
  }

  function formatMoney(amount: number): string {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
  }

  return (
    <div className="crm-page-container">
      {/* Top Header */}
      <div className="crm-page-header">
        <div>
          <h1 className="crm-page-title">Заявки ({totalLeads})</h1>
          <p className="crm-page-subtitle">Воронка продаж, обработка лидов и аналитика</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View Mode Toggle: Kanban vs Table */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: 'var(--crm-card)',
              border: '1px solid var(--crm-border)',
              borderRadius: '8px',
              padding: '2px'
            }}
          >
            <button
              type="button"
              className={`crm-btn crm-btn--xs ${viewMode === 'kanban' ? 'crm-btn--accent' : 'crm-btn--ghost'}`}
              onClick={() => setViewMode('kanban')}
              style={{ border: 0 }}
            >
              📋 Канбан-доска
            </button>
            <button
              type="button"
              className={`crm-btn crm-btn--xs ${viewMode === 'table' ? 'crm-btn--accent' : 'crm-btn--ghost'}`}
              onClick={() => setViewMode('table')}
              style={{ border: 0 }}
            >
              📑 Таблица
            </button>
          </div>

          {/* Add Lead Button */}
          <button
            className="crm-btn crm-btn--accent"
            onClick={() => setCreateModalOpen(true)}
            style={{ fontWeight: 600 }}
          >
            ➕ Добавить заявку
          </button>

          <button
            className="crm-btn crm-btn--secondary"
            onClick={handleExportCsv}
            disabled={exporting}
            title="Экспорт в CSV с защитой от инъекций и UTF-8 BOM"
          >
            {exporting ? 'Экспорт...' : '📥 Экспорт'}
          </button>

          <button className="crm-btn crm-btn--secondary" onClick={loadLeads} title="Обновить данные">
            🔄
          </button>
        </div>
      </div>

      {error && <div className="crm-alert crm-alert--danger" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Filter Bar Component */}
      <FilterBar
        search={search}
        onSearchChange={val => {
          setSearch(val);
          setPage(1);
        }}
        status={status}
        onStatusChange={val => {
          setStatus(val);
          setPage(1);
        }}
        temperature={temperature}
        onTemperatureChange={val => {
          setTemperature(val);
          setPage(1);
        }}
        manager={manager}
        onManagerChange={val => {
          setManager(val);
          setPage(1);
        }}
        source={source}
        onSourceChange={val => {
          setSource(val);
          setPage(1);
        }}
        dateFrom={dateFrom}
        onDateFromChange={val => {
          setDateFrom(val);
          setPage(1);
        }}
        dateTo={dateTo}
        onDateToChange={val => {
          setDateTo(val);
          setPage(1);
        }}
        onReset={resetFilters}
      />

      {/* Main Content: Kanban or Table */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          leads={leads}
          onOpenLead={onOpenLead}
          onMoveLead={handleMoveLead}
          onUpdateTemperature={handleUpdateTemperature}
          onAssignManager={handleAssignManager}
        />
      ) : (
        /* Table View */
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="crm-table-container">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Телефон / Email</th>
                  <th>Сумма сделки</th>
                  <th>Температура</th>
                  <th>Менеджер</th>
                  <th>Статус</th>
                  <th>Источник</th>
                  <th
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSortOrder(prev => (prev === 'DESC' ? 'ASC' : 'DESC'))}
                  >
                    Дата {sortOrder === 'DESC' ? '▼' : '▲'}
                  </th>
                  <th>Уведомления</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--crm-muted)' }}>
                      Загрузка заявок...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--crm-muted)' }}>
                      Заявок не найдено. Измените параметры фильтра или создайте новую заявку.
                    </td>
                  </tr>
                ) : (
                  leads.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => onOpenLead(lead.id)}
                      style={{ cursor: 'pointer' }}
                      className="crm-table-row"
                    >
                      <td>
                        <strong style={{ color: '#fff' }}>{lead.name}</strong>
                        {lead.message && (
                          <div style={{ fontSize: '11px', color: 'var(--crm-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lead.message}
                          </div>
                        )}
                      </td>
                      <td>
                        {lead.phone && (
                          <div>
                            <a
                              href={`tel:${lead.phone}`}
                              className="crm-link"
                              onClick={e => e.stopPropagation()}
                              style={{ fontWeight: 600 }}
                            >
                              {lead.phone}
                            </a>
                          </div>
                        )}
                        {lead.email && (
                          <div style={{ fontSize: '12px', color: 'var(--crm-muted)' }}>
                            {lead.email}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: lead.amount > 0 ? '#4ade80' : 'var(--crm-muted)' }}>
                          {lead.amount > 0 ? formatMoney(lead.amount) : '—'}
                        </span>
                      </td>
                      <td>
                        {lead.temperature === 'attention' && (
                          <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            ⚠️ Внимание
                          </span>
                        )}
                        {lead.temperature === 'good' && (
                          <span style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(34, 197, 94, 0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            🌟 Тёплый
                          </span>
                        )}
                        {(!lead.temperature || lead.temperature === 'cold') && (
                          <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(14, 165, 233, 0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            ❄️ Холодный
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: lead.manager ? '#f3f4f6' : 'var(--crm-muted)' }}>
                          {lead.manager || '—'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={lead.status} size="sm" />
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--crm-muted)' }}>
                          {lead.source_name || 'Сайт'}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--crm-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(lead.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td>
                        <NotificationBadge state={lead.notification_state} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px',
                borderTop: '1px solid var(--crm-border)'
              }}
            >
              <div style={{ fontSize: '13px', color: 'var(--crm-muted)' }}>
                Страница {page} из {totalPages} (всего {totalLeads})
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="crm-btn crm-btn--sm crm-btn--secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  ← Назад
                </button>
                <button
                  className="crm-btn crm-btn--sm crm-btn--secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Вперёд →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Lead Modal */}
      <CreateLeadModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onLeadCreated={() => {
          loadLeads();
        }}
      />
    </div>
  );
};
