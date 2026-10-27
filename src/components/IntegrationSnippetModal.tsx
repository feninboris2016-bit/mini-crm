import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  siteApiKeyPreview: string;
}

export const IntegrationSnippetModal: React.FC<Props> = ({ isOpen, onClose, siteApiKeyPreview }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;

  const snippetCode = `<!-- 1. HTML форма для сайта с защитой от спама (honeypot) -->
<form id="leadForm" onsubmit="sendLeadToCrm(event)">
  <input type="text" name="name" placeholder="Ваше имя" required />
  <input type="tel" name="phone" placeholder="+7 (999) 000-00-00" />
  <input type="email" name="email" placeholder="client@mail.ru" />
  <textarea name="message" placeholder="Ваше сообщение или пожелания"></textarea>
  
  <!-- Защитное поле-ловушка для спам-ботов (должно оставаться скрытым и пустым) -->
  <input type="text" name="_hp_bio" style="display:none !important;" tabindex="-1" autocomplete="off" />
  
  <button type="submit" id="submitBtn">Отправить заявку</button>
  <div id="formNotice" style="margin-top:10px;"></div>
</form>

<!-- 2. Скрипт отправки заявки в вашу Мини-CRM -->
<script>
async function sendLeadToCrm(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('submitBtn');
  const notice = document.getElementById('formNotice');
  btn.disabled = true;
  notice.textContent = 'Отправка...';

  const payload = {
    name: form.name.value,
    phone: form.phone.value,
    email: form.email.value,
    message: form.message.value,
    source_url: window.location.href,
    source_name: document.title || 'Форма сайта',
    _hp_bio: form._hp_bio.value, // honeypot
    external_idempotency_key: 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  };

  try {
    const res = await fetch('${currentOrigin}/api/v1/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Key': '${siteApiKeyPreview || 'ВАШ_SITE_API_KEY'}'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
      notice.style.color = '#22c55e';
      notice.textContent = '✓ Заявка успешно принята! Мы скоро свяжемся с вами.';
      form.reset();
    } else {
      notice.style.color = '#ef4444';
      notice.textContent = 'Ошибка: ' + (data.error || 'Не удалось отправить заявку');
    }
  } catch (err) {
    notice.style.color = '#ef4444';
    notice.textContent = 'Ошибка сети. Попробуйте еще раз.';
  } finally {
    btn.disabled = false;
  }
}
</script>`;

  function copyCode() {
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-content" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <h2 className="crm-modal-title">🔌 Подключение сайта к Мини-CRM</h2>
          <button className="crm-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="crm-modal-body">
          <p style={{ color: 'var(--crm-muted)', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
            Скопируйте этот готовый фрагмент HTML/JavaScript и вставьте его на ваш сайт (или адаптируйте существующую форму под вызов <code>POST {currentOrigin}/api/v1/leads</code>).
          </p>

          <div style={{ position: 'relative' }}>
            <pre className="crm-code-block">{snippetCode}</pre>
            <button
              className="crm-btn crm-btn--sm crm-btn--accent"
              onClick={copyCode}
              style={{ position: 'absolute', top: '12px', right: '12px' }}
            >
              {copied ? '✓ Скопировано!' : 'Копировать код'}
            </button>
          </div>

          <div style={{ marginTop: '20px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '8px', padding: '14px', fontSize: '13px', lineHeight: 1.5 }}>
            <strong style={{ color: '#818cf8', display: 'block', marginBottom: '4px' }}>🛡️ О защите API:</strong>
            - В форму встроен <code>Honeypot</code> (скрытое поле-ловушка для отсеивания спам-ботов).<br />
            - Сервер автоматически защищает от перегрузок и спам-атак (Rate Limiting).<br />
            - При необходимости ограничьте домен в настройках CRM (поле <code>ALLOWED_ORIGIN</code>).
          </div>
        </div>
      </div>
    </div>
  );
};
