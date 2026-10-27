import React, { useState, useEffect } from 'react';
import { api, setToken } from './api';
import { User } from './types';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { LeadDetailModal } from './components/LeadDetailModal';
import { IntegrationSnippetModal } from './components/IntegrationSnippetModal';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [isSnippetOpen, setIsSnippetOpen] = useState(false);
  const [siteApiKeyPreview, setSiteApiKeyPreview] = useState('');

  useEffect(() => {
    checkAuth();
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  async function checkAuth() {
    try {
      const res = await api.getMe();
      setUser(res.user);
      // Also fetch settings to get site API key preview for snippet modal
      api.getSettings().then(s => {
        setSiteApiKeyPreview(s.settings.site_api_key_preview || '');
      }).catch(() => {});
    } catch {
      setUser(null);
    } finally {
      setAuthChecking(false);
    }
  }

  function handleHashChange() {
    const hash = window.location.hash.slice(1);
    if (!hash || hash === '/' || hash === '/dashboard') {
      setCurrentTab('dashboard');
      setActiveLeadId(null);
    } else if (hash === '/leads') {
      setCurrentTab('leads');
      setActiveLeadId(null);
    } else if (hash.startsWith('/leads/')) {
      const id = hash.replace('/leads/', '');
      setCurrentTab('leads');
      setActiveLeadId(id);
    } else if (hash === '/settings') {
      setCurrentTab('settings');
      setActiveLeadId(null);
    } else if (hash === '/audit') {
      setCurrentTab('audit');
      setActiveLeadId(null);
    }
  }

  function navigateTo(tab: string) {
    setCurrentTab(tab);
    window.location.hash = `#/${tab}`;
  }

  async function handleLogout() {
    await api.logout();
    setUser(null);
    window.location.hash = '#/login';
  }

  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        Загрузка Мини-CRM...
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={loggedInUser => {
          setUser(loggedInUser);
          window.location.hash = '#/dashboard';
        }}
      />
    );
  }

  return (
    <div className="crm-app">
      <Navbar
        currentTab={currentTab}
        onSelectTab={navigateTo}
        user={user}
        onLogout={handleLogout}
        onOpenSnippet={() => setIsSnippetOpen(true)}
      />

      <main className="crm-main-content">
        {currentTab === 'dashboard' && (
          <DashboardPage
            onOpenLead={id => {
              setActiveLeadId(id);
              window.location.hash = `#/leads/${id}`;
            }}
            onNavigateTab={navigateTo}
          />
        )}

        {currentTab === 'leads' && (
          <LeadsPage
            onOpenLead={id => {
              setActiveLeadId(id);
              window.location.hash = `#/leads/${id}`;
            }}
          />
        )}

        {currentTab === 'settings' && <SettingsPage />}

        {currentTab === 'audit' && <AuditLogPage />}
      </main>

      {/* Lead Detail Modal */}
      {activeLeadId && (
        <LeadDetailModal
          leadId={activeLeadId}
          onClose={() => {
            setActiveLeadId(null);
            window.location.hash = '#/leads';
          }}
          onLeadUpdated={() => {
            // refresh event if needed
          }}
        />
      )}

      {/* Integration Snippet Modal */}
      <IntegrationSnippetModal
        isOpen={isSnippetOpen}
        onClose={() => setIsSnippetOpen(false)}
        siteApiKeyPreview={siteApiKeyPreview}
      />
    </div>
  );
};
