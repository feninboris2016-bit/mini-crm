import React from 'react';

interface Props {
  status: 'new' | 'in_progress' | 'won' | 'lost' | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const configs: Record<string, { label: string; bg: string; color: string; border: string }> = {
    new: {
      label: 'Новая',
      bg: 'rgba(99, 102, 241, 0.15)',
      color: '#818cf8',
      border: 'rgba(99, 102, 241, 0.3)'
    },
    in_progress: {
      label: 'В работе',
      bg: 'rgba(245, 158, 11, 0.15)',
      color: '#fbbf24',
      border: 'rgba(245, 158, 11, 0.3)'
    },
    negotiation: {
      label: 'Переговоры',
      bg: 'rgba(168, 85, 247, 0.15)',
      color: '#c084fc',
      border: 'rgba(168, 85, 247, 0.3)'
    },
    won: {
      label: 'Успешно',
      bg: 'rgba(34, 197, 94, 0.15)',
      color: '#4ade80',
      border: 'rgba(34, 197, 94, 0.3)'
    },
    lost: {
      label: 'Отказ',
      bg: 'rgba(239, 68, 68, 0.15)',
      color: '#f87171',
      border: 'rgba(239, 68, 68, 0.3)'
    }
  };

  const conf = configs[status] || {
    label: status,
    bg: 'rgba(148, 163, 184, 0.15)',
    color: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.3)'
  };

  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: isSmall ? '2px 8px' : '4px 12px',
        borderRadius: '9999px',
        fontSize: isSmall ? '12px' : '13px',
        fontWeight: 600,
        backgroundColor: conf.bg,
        color: conf.color,
        border: `1px solid ${conf.border}`,
        whiteSpace: 'nowrap'
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: conf.color,
          marginRight: '6px'
        }}
      />
      {conf.label}
    </span>
  );
};
