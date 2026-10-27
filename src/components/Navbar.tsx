import React, { useState } from 'react';
import { User } from '../types';

interface Props {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
  onOpenSnippet: () => void;
}

export const Navbar: React.FC<Props> = ({
  currentTab,
  onSelectTab,
  user,
  onLogout,
  onOpenSnippet
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: '📊 Обзор' },
    { id: 'leads', label: '👥 Заявки' },
    { id: 'settings', label: '⚙️ Настройки' },
    { id: 'audit', label: '📜 Журнал аудита' }
  ];

  return (
    <header className="crm-navbar">
      <div className="crm-navbar__container">
        {/* Brand */}
        <div className="crm-navbar__brand" onClick={() => onSelectTab('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="crm-navbar__logo-badge">CRM</div>
          <div>
            <div className="crm-navbar__title">Мини-CRM</div>
            <div className="crm-navbar__subtitle">Сбор заявок сайта</div>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="crm-navbar__nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`crm-nav-link ${currentTab === item.id ? 'crm-nav-link--active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Action Controls */}
        <div className="crm-navbar__actions">
          <button className="crm-btn crm-btn--accent-soft" onClick={onOpenSnippet} title="Код для вставки на сайт">
            🔌 Подключить сайт
          </button>

          {user && (
            <div className="crm-navbar__user">
              <span className="crm-navbar__email" title={user.email}>
                {user.email}
              </span>
              <button className="crm-btn crm-btn--sm crm-btn--danger-ghost" onClick={onLogout} title="Выйти из системы">
                Выход
              </button>
            </div>
          )}

          {/* Mobile hamburger button */}
          <button
            className="crm-navbar__burger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Меню"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="crm-navbar__mobile-menu">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`crm-nav-link-mobile ${currentTab === item.id ? 'crm-nav-link-mobile--active' : ''}`}
              onClick={() => {
                onSelectTab(item.id);
                setMobileMenuOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="crm-btn crm-btn--accent-soft"
              onClick={() => {
                onOpenSnippet();
                setMobileMenuOpen(false);
              }}
            >
              🔌 Подключить сайт
            </button>
            <button className="crm-btn crm-btn--danger-ghost" onClick={onLogout}>
              Выйти ({user?.email})
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
