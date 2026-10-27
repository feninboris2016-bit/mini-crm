import React, { useState } from 'react';

interface FilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  temperature: string;
  onTemperatureChange: (val: string) => void;
  manager: string;
  onManagerChange: (val: string) => void;
  source: string;
  onSourceChange: (val: string) => void;
  dateFrom: string;
  onDateFromChange: (val: string) => void;
  dateTo: string;
  onDateToChange: (val: string) => void;
  onReset: () => void;
  managersList?: string[];
  sourcesList?: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  temperature,
  onTemperatureChange,
  manager,
  onManagerChange,
  source,
  onSourceChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onReset,
  managersList = ['Алексей', 'Дмитрий', 'Мария', 'Елена', 'Иван'],
  sourcesList = ['Сайт', 'Яндекс Директ', 'VK лид-форма', 'Telegram', 'WhatsApp', 'Звонок', 'Ручное добавление']
}) => {
  const [expanded, setExpanded] = useState(false);

  // Count active filters (ignoring empty / 'all')
  const activeCount = [
    status !== 'all' ? status : '',
    temperature !== 'all' ? temperature : '',
    manager !== 'all' ? manager : '',
    source !== 'all' ? source : '',
    dateFrom,
    dateTo
  ].filter(Boolean).length;

  return (
    <div className="crm-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
      {/* Top Search & Toggle Row */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', position: 'relative' }}>
          <input
            type="text"
            className="crm-input"
            placeholder="🔍 Поиск по имени, номеру, email, заметкам..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>

        {/* Status quick select */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="crm-select"
            value={status}
            onChange={e => onStatusChange(e.target.value)}
            style={{ width: 'auto', minWidth: '140px' }}
          >
            <option value="all">Все статусы</option>
            <option value="new">🆕 Новые</option>
            <option value="in_progress">⚙️ В работе</option>
            <option value="negotiation">🤝 Переговоры</option>
            <option value="won">🎉 Успешно</option>
            <option value="lost">❌ Отказ</option>
          </select>

          <select
            className="crm-select"
            value={temperature}
            onChange={e => onTemperatureChange(e.target.value)}
            style={{ width: 'auto', minWidth: '150px' }}
          >
            <option value="all">Все температуры</option>
            <option value="cold">❄️ Холодный</option>
            <option value="attention">⚠️ Требует внимания</option>
            <option value="good">🌟 Тёплый / Хорошо</option>
          </select>

          <button
            type="button"
            className={`crm-btn ${expanded ? 'crm-btn--accent' : 'crm-btn--secondary'}`}
            onClick={() => setExpanded(!expanded)}
            style={{ position: 'relative' }}
          >
            ⚙️ Фильтры
            {activeCount > 0 && (
              <span
                style={{
                  marginLeft: '6px',
                  background: 'var(--crm-danger)',
                  color: '#fff',
                  borderRadius: '9999px',
                  padding: '1px 6px',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                {activeCount}
              </span>
            )}
          </button>

          {(activeCount > 0 || search) && (
            <button
              type="button"
              className="crm-btn crm-btn--ghost"
              onClick={onReset}
              title="Сбросить все фильтры"
            >
              ✕ Сброс
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters Drawer */}
      {expanded && (
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--crm-border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px'
          }}
        >
          {/* Manager Filter */}
          <div>
            <label className="crm-label" style={{ fontSize: '12px' }}>Ответственный менеджер</label>
            <select
              className="crm-select"
              value={manager}
              onChange={e => onManagerChange(e.target.value)}
            >
              <option value="all">Все менеджеры</option>
              {managersList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="crm-label" style={{ fontSize: '12px' }}>Источник заявки</label>
            <select
              className="crm-select"
              value={source}
              onChange={e => onSourceChange(e.target.value)}
            >
              <option value="all">Все источники</option>
              {sourcesList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="crm-label" style={{ fontSize: '12px' }}>Дата создания с</label>
            <input
              type="date"
              className="crm-input"
              value={dateFrom}
              onChange={e => onDateFromChange(e.target.value)}
            />
          </div>

          {/* Date To */}
          <div>
            <label className="crm-label" style={{ fontSize: '12px' }}>Дата создания по</label>
            <input
              type="date"
              className="crm-input"
              value={dateTo}
              onChange={e => onDateToChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
