import React, { useState } from 'react';
import { Lead } from '../types';

interface Props {
  leads: Lead[];
  onOpenLead: (leadId: string) => void;
  onMoveLead: (leadId: string, toStatus: string) => void;
  onUpdateTemperature: (leadId: string, temperature: string) => void;
  onAssignManager: (leadId: string, manager: string) => void;
  managersList?: string[];
}

interface ColumnDef {
  key: string;
  label: string;
  color: string;
  icon: string;
  borderHeader: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'new', label: 'Новые', color: '#6366f1', icon: '🆕', borderHeader: 'rgba(99, 102, 241, 0.4)' },
  { key: 'in_progress', label: 'В работе', color: '#f59e0b', icon: '⚙️', borderHeader: 'rgba(245, 158, 11, 0.4)' },
  { key: 'negotiation', label: 'Переговоры', color: '#a855f7', icon: '🤝', borderHeader: 'rgba(168, 85, 247, 0.4)' },
  { key: 'won', label: 'Успешно', color: '#22c55e', icon: '🎉', borderHeader: 'rgba(34, 197, 94, 0.4)' },
  { key: 'lost', label: 'Отказ', color: '#ef4444', icon: '❌', borderHeader: 'rgba(239, 68, 68, 0.4)' }
];

export const KanbanBoard: React.FC<Props> = ({
  leads,
  onOpenLead,
  onMoveLead,
  onUpdateTemperature,
  onAssignManager,
  managersList = ['Алексей', 'Дмитрий', 'Мария', 'Елена', 'Иван']
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetCol, setDropTargetCol] = useState<string | null>(null);

  // Group leads by status
  const grouped: Record<string, Lead[]> = {};
  COLUMNS.forEach(col => {
    grouped[col.key] = [];
  });

  leads.forEach(lead => {
    const key = grouped[lead.status] ? lead.status : 'new';
    grouped[key].push(lead);
  });

  function formatMoney(amount: number): string {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
  }

  function formatShortDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  }

  function isLeadStale(lead: Lead): boolean {
    if (lead.status !== 'new' && lead.status !== 'in_progress') return false;
    const date = new Date(lead.updated_at || lead.created_at);
    if (isNaN(date.getTime())) return false;
    const days = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 2;
  }

  function getTemperatureConfig(temp: string) {
    switch (temp) {
      case 'attention':
        return {
          border: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.08)',
          label: 'Требует внимания',
          dot: '#ef4444'
        };
      case 'good':
        return {
          border: '#22c55e',
          bg: 'rgba(34, 197, 94, 0.08)',
          label: 'Всё хорошо / Тёплый',
          dot: '#22c55e'
        };
      case 'cold':
      default:
        return {
          border: '#0ea5e9',
          bg: 'rgba(14, 165, 233, 0.08)',
          label: 'Холодный',
          dot: '#0ea5e9'
        };
    }
  }

  // Drag and drop handlers
  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent, colKey: string) {
    e.preventDefault();
    if (dropTargetCol !== colKey) {
      setDropTargetCol(colKey);
    }
  }

  function handleDrop(e: React.DragEvent, colKey: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggingId;
    if (id) {
      onMoveLead(id, colKey);
    }
    setDraggingId(null);
    setDropTargetCol(null);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTargetCol(null);
  }

  return (
    <div
      className="crm-kanban-board"
      style={{
        display: 'flex',
        gap: '16px',
        overflowX: 'auto',
        paddingBottom: '24px',
        alignItems: 'flex-start',
        minHeight: 'calc(100vh - 240px)'
      }}
    >
      {COLUMNS.map(col => {
        const colLeads = grouped[col.key] || [];
        const colSum = colLeads.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
        const isTarget = dropTargetCol === col.key && draggingId !== null;

        return (
          <div
            key={col.key}
            className="crm-kanban-column"
            style={{
              flex: '0 0 310px',
              width: '310px',
              backgroundColor: 'rgba(17, 24, 39, 0.6)',
              backdropFilter: 'blur(4px)',
              border: `1px solid ${isTarget ? 'var(--crm-accent)' : 'var(--crm-border)'}`,
              borderRadius: 'var(--crm-radius)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - 200px)',
              transition: 'all 0.2s ease',
              boxShadow: isTarget ? '0 0 0 2px var(--crm-accent)' : 'none'
            }}
            onDragOver={e => handleDragOver(e, col.key)}
            onDrop={e => handleDrop(e, col.key)}
          >
            {/* Column Header */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: `2px solid ${col.borderHeader}`,
                background: 'rgba(17, 24, 39, 0.9)',
                borderTopLeftRadius: 'var(--crm-radius)',
                borderTopRightRadius: 'var(--crm-radius)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>{col.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--crm-text)' }}>
                  {col.label}
                </span>
                <span
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'var(--crm-muted)',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px'
                  }}
                >
                  {colLeads.length}
                </span>
              </div>

              {/* Total pipeline sum in this stage */}
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>
                {colSum > 0 ? formatMoney(colSum) : '0 ₽'}
              </div>
            </div>

            {/* Column Cards Container */}
            <div
              style={{
                padding: '10px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                flex: 1,
                minHeight: '120px'
              }}
            >
              {/* Drop Target Hint */}
              {isTarget && (
                <div
                  style={{
                    padding: '16px',
                    border: '2px dashed var(--crm-accent)',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--crm-accent)',
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: '12px'
                  }}
                >
                  ⬇️ Поставить сюда
                </div>
              )}

              {colLeads.map(lead => {
                const tempConf = getTemperatureConfig(lead.temperature);
                const stale = isLeadStale(lead);
                const isDragging = draggingId === lead.id;

                return (
                  <div
                    key={lead.id}
                    className="crm-kanban-card"
                    draggable
                    onDragStart={e => handleDragStart(e, lead.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onOpenLead(lead.id)}
                    style={{
                      backgroundColor: 'var(--crm-card)',
                      border: '1px solid var(--crm-border)',
                      borderLeft: `5px solid ${tempConf.border}`,
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'grab',
                      opacity: isDragging ? 0.35 : 1,
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    {/* Top Row: Client Name + Quick Temperature Dots */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#f3f4f6', lineHeight: 1.3 }}>
                        {lead.name}
                      </div>

                      {/* Temperature Quick Switcher (Chatium CRM style) */}
                      <div
                        style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {(['cold', 'attention', 'good'] as const).map(tKey => {
                          const conf = getTemperatureConfig(tKey);
                          const isActive = lead.temperature === tKey;
                          return (
                            <button
                              key={tKey}
                              type="button"
                              title={`Переключить температуру: ${conf.label}`}
                              onClick={() => onUpdateTemperature(lead.id, tKey)}
                              style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                backgroundColor: conf.dot,
                                border: isActive ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                                opacity: isActive ? 1 : 0.35,
                                transform: isActive ? 'scale(1.15)' : 'scale(0.9)',
                                cursor: 'pointer',
                                padding: 0,
                                transition: 'all 0.15s ease'
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Phone & Stale badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          className="crm-link"
                          style={{ fontSize: '12px', fontWeight: 600, color: '#93c5fd' }}
                          onClick={e => e.stopPropagation()}
                        >
                          📞 {lead.phone}
                        </a>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--crm-muted)' }}>
                          {lead.email || 'Нет контактов'}
                        </span>
                      )}

                      {stale && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171'
                          }}
                          title="Лид без движения более 2 дней"
                        >
                          ⚠️ Без движения
                        </span>
                      )}
                    </div>

                    {/* Deal Value & Source */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '8px',
                        paddingTop: '6px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: lead.amount > 0 ? '#4ade80' : 'var(--crm-muted)'
                        }}
                      >
                        {lead.amount > 0 ? formatMoney(lead.amount) : 'Бюджет не указан'}
                      </span>

                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--crm-muted)'
                        }}
                      >
                        {lead.source_name || 'Сайт'}
                      </span>
                    </div>

                    {/* Next Callback / Note preview if present */}
                    {lead.next_call_at && (
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '11px',
                          color: '#fbbf24',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ⏰ Перезвон: {new Date(lead.next_call_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}

                    {lead.message && (
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '11px',
                          color: '#9ca3af',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {lead.message}
                      </div>
                    )}

                    {/* Footer Row: Responsible Manager + Quick Stage Switch */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '10px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        gap: '6px'
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Responsible Selector */}
                      <select
                        value={lead.manager || ''}
                        onChange={e => onAssignManager(lead.id, e.target.value)}
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: lead.manager ? '#f3f4f6' : 'var(--crm-muted)',
                          fontSize: '11px',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          maxWidth: '120px',
                          outline: 'none'
                        }}
                        title={lead.manager ? `Ответственный: ${lead.manager}` : 'Назначить менеджера'}
                      >
                        <option value="">+ Менеджер</option>
                        {managersList.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>

                      {/* Quick stage selector */}
                      <select
                        value={lead.status}
                        onChange={e => onMoveLead(lead.id, e.target.value)}
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--crm-muted)',
                          fontSize: '11px',
                          borderRadius: '4px',
                          padding: '3px 6px',
                          outline: 'none'
                        }}
                        title="Перенести в этап"
                      >
                        {COLUMNS.map(c => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>

                      {/* Date created */}
                      <span style={{ fontSize: '10px', color: 'var(--crm-muted)', marginLeft: 'auto' }}>
                        {formatShortDate(lead.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {colLeads.length === 0 && !isTarget && (
                <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--crm-muted)', fontSize: '12px' }}>
                  Нет заявок
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
