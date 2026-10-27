import React, { useState } from 'react';
import { api } from '../api';
import { User } from '../types';

interface Props {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    try {
      setLoading(true);
      setError('');
      const res = await api.login(email.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Ошибка входа в систему');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="crm-login-wrap">
      <div className="crm-login-card">
        <div className="crm-login-header">
          <div className="crm-navbar__logo-badge" style={{ margin: '0 auto 12px' }}>
            CRM
          </div>
          <h1 className="crm-login-title">Вход в Мини-CRM</h1>
          <p className="crm-login-subtitle">
            Защищённая панель управления заявками
          </p>
        </div>

        {error && (
          <div className="crm-alert crm-alert--danger" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="crm-form-group">
            <label className="crm-label">Email администратора</label>
            <input
              type="email"
              className="crm-input"
              placeholder="admin@crm.local"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="crm-form-group">
            <label className="crm-label">Пароль</label>
            <input
              type="password"
              className="crm-input"
              placeholder="••••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="crm-btn crm-btn--accent crm-btn--wide"
            disabled={loading}
            style={{ marginTop: '12px' }}
          >
            {loading ? 'Проверка...' : 'Войти в систему'}
          </button>
        </form>

        <div className="crm-login-footer">
          <span>🛡️ Защита от перебора паролей (Brute-force protection)</span>
        </div>
      </div>
    </div>
  );
};
