import React from 'react';

interface Props {
  state: 'pending' | 'sent' | 'partial' | 'failed' | string;
}

export const NotificationBadge: React.FC<Props> = ({ state }) => {
  const configs: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    sent: {
      label: 'Отправлено',
      icon: '✓',
      color: '#4ade80',
      bg: 'rgba(34, 197, 94, 0.12)'
    },
    partial: {
      label: 'Частично',
      icon: '◑',
      color: '#fbbf24',
      bg: 'rgba(245, 158, 11, 0.12)'
    },
    pending: {
      label: 'В очереди',
      icon: '⏳',
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.12)'
    },
    failed: {
      label: 'Ошибка',
      icon: '✕',
      color: '#f87171',
      bg: 'rgba(239, 68, 68, 0.12)'
    }
  };

  const conf = configs[state] || configs.pending;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 500,
        color: conf.color,
        backgroundColor: conf.bg
      }}
      title={`Статус доставки уведомлений: ${conf.label}`}
    >
      <span>{conf.icon}</span>
      <span>{conf.label}</span>
    </span>
  );
};
