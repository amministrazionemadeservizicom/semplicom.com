/**
 * wa-popup.js — SempliCom
 * Mostra un popup "compila il questionario" quando l'utente clicca un link WhatsApp.
 * Max una volta per visitatore (localStorage). Mai se ha già compilato.
 */
(function () {
  'use strict';

  var SHOWN_KEY = 'sc_wa_popup_shown';
  var DONE_KEY  = 'sc_questionnaire_done';
  var POPUP_URL = '/questionario-registrazione/?origine=sito-whatsapp';

  function alreadySeen() {
    try {
      return !!(localStorage.getItem(SHOWN_KEY) || localStorage.getItem(DONE_KEY));
    } catch (_) { return false; }
  }

  function markSeen() {
    try { localStorage.setItem(SHOWN_KEY, '1'); } catch (_) {}
  }

  function buildPopup() {
    var style = document.createElement('style');
    style.textContent = [
      '#sc-wa-popup{',
        'display:none;position:fixed;bottom:24px;left:50%;',
        'transform:translateX(-50%);z-index:99999;',
        'width:calc(100% - 32px);max-width:420px;',
        'background:#fff;border-radius:14px;',
        'box-shadow:0 8px 40px rgba(0,0,0,.18);',
        'border-top:4px solid #F2C927;',
        'padding:20px;',
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      '}',
      '#sc-wa-popup.sc-vis{display:block;animation:sc-slide .28s ease;}',
      '@keyframes sc-slide{',
        'from{opacity:0;transform:translateX(-50%) translateY(16px)}',
        'to{opacity:1;transform:translateX(-50%) translateY(0)}',
      '}',
      '#sc-wa-row{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;}',
      '#sc-wa-msg{',
        'flex:1;margin:0;font-size:15px;font-weight:600;',
        'color:#212529;line-height:1.45;',
      '}',
      '#sc-wa-x{',
        'flex-shrink:0;width:28px;height:28px;border-radius:50%;',
        'border:none;background:#f0f0f0;cursor:pointer;',
        'font-size:18px;line-height:1;color:#6c757d;',
        'display:flex;align-items:center;justify-content:center;',
        'font-family:inherit;padding:0;',
      '}',
      '#sc-wa-x:hover{background:#e0e0e0;}',
      '#sc-wa-cta{',
        'display:block;width:100%;padding:13px 20px;',
        'background:#F2C927;color:#212529;',
        'font-size:15px;font-weight:700;text-align:center;',
        'border-radius:8px;text-decoration:none;',
        'border:none;cursor:pointer;font-family:inherit;',
        'transition:background .15s;',
      '}',
      '#sc-wa-cta:hover{background:#D4AD1C;text-decoration:none;}',
      '@media(max-width:480px){#sc-wa-popup{bottom:16px;}}',
    ].join('');
    document.head.appendChild(style);

    var el = document.createElement('div');
    el.id = 'sc-wa-popup';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Compila il questionario');
    el.innerHTML =
      '<div id="sc-wa-row">' +
        '<p id="sc-wa-msg">Mentre ci scrivi su WhatsApp, compila il questionario per attivare subito il tuo accesso \uD83D\uDC47</p>' +
        '<button id="sc-wa-x" aria-label="Chiudi">\u00D7</button>' +
      '</div>' +
      '<a id="sc-wa-cta" href="' + POPUP_URL + '">Compila il questionario</a>';
    document.body.appendChild(el);

    document.getElementById('sc-wa-x').addEventListener('click', function () {
      el.classList.remove('sc-vis');
    });

    return el;
  }

  function init() {
    if (alreadySeen()) return;

    var popup = null;

    // Usa capture per intercettare prima che il browser segua il link
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href*="wa.me"]');
      if (!a) return;
      if (alreadySeen()) return;

      markSeen();
      if (!popup) popup = buildPopup();

      // Breve ritardo: lascia aprire WhatsApp/app prima di mostrare il popup
      setTimeout(function () { popup.classList.add('sc-vis'); }, 400);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
