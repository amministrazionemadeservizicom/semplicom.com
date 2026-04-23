// netlify/edge-functions/pun-seo.js
// Inietta dati PUN live nell'HTML *server-side* prima che venga servito.
// Così Google vede sempre valori freschi nell'HTML statico, senza aspettare JS.
// Fonte dati: /.netlify/functions/energy-prices (GME API + energy-charts.info)

export default async (request, context) => {
  // Ottieni l'HTML statico dal filesystem
  const response = await context.next();
  if (!response.ok) return response;

  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;

  // Chiama la funzione energy-prices per dati live
  let data = null;
  try {
    const apiUrl = new URL('/.netlify/functions/energy-prices', request.url);
    const ctrl   = new AbortController();
    const timer  = setTimeout(() => ctrl.abort(), 5000);
    const apiRes = await fetch(apiUrl.toString(), { signal: ctrl.signal });
    clearTimeout(timer);
    if (apiRes.ok) data = await apiRes.json();
  } catch (_) {
    // Se l'API fallisce, restituisce l'HTML originale con valori statici
    return response;
  }

  if (!data || !data.pun) return response;

  const pun   = data.pun;
  const today = new Date();
  const y     = today.getFullYear();
  const m     = today.getMonth();       // 0-based
  const d     = today.getDate();
  const mm    = String(m + 1).padStart(2, '0');
  const dd    = String(d).padStart(2, '0');

  const MONTH_IT = ['gennaio','febbraio','marzo','aprile','maggio','giugno',
                    'luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const MONTH_CAP = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                     'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

  const badgeDate = `${d} ${MONTH_IT[m]} ${y}`;
  const dayStr    = `${d}/${mm}`;
  const todayISO  = `${y}-${mm}-${dd}`;
  const monthYear = `${MONTH_CAP[m]} ${y}`;

  const fmt = n => (n != null && !isNaN(n)) ? String(n).replace('.', ',') : '—';

  let html = await response.text();

  // ── Badge data aggiornamento ────────────────────────────────────────────────
  html = html.replace(
    /id="pun-badge">[^<]+</,
    `id="pun-badge">✓ Aggiornato al ${badgeDate}<`
  );

  // ── Titolo H1 ──────────────────────────────────────────────────────────────
  html = html.replace(
    /id="pun-h1">[^<]+</,
    `id="pun-h1">PUN Oggi — ${monthYear}<`
  );

  // ── Card KPI: avg ──────────────────────────────────────────────────────────
  html = html.replace(
    /id="pun-avg-label">[^<]+</,
    `id="pun-avg-label">PUN medio ${MONTH_CAP[m].toLowerCase()} ${y}<`
  );
  html = html.replace(
    /id="pun-avg-value">[^<]+</,
    `id="pun-avg-value">${fmt(pun.avg)}<`
  );
  html = html.replace(
    /id="pun-avg-sub">[^<]+</,
    `id="pun-avg-sub">€/MWh (dato parziale al ${dayStr})<`
  );

  // ── Card KPI: min ──────────────────────────────────────────────────────────
  if (pun.min != null) {
    html = html.replace(
      /id="pun-min-label">[^<]+</,
      `id="pun-min-label">Minimo ${MONTH_CAP[m].toLowerCase()} ${y}<`
    );
    html = html.replace(
      /id="pun-min-value">[^<]+</,
      `id="pun-min-value">${fmt(pun.min)}<`
    );
  }

  // ── Card KPI: max ──────────────────────────────────────────────────────────
  if (pun.max != null) {
    html = html.replace(
      /id="pun-max-label">[^<]+</,
      `id="pun-max-label">Massimo ${MONTH_CAP[m].toLowerCase()} ${y}<`
    );
    html = html.replace(
      /id="pun-max-value">[^<]+</,
      `id="pun-max-value">${fmt(pun.max)}<`
    );
  }

  // ── Card KPI: prev month ───────────────────────────────────────────────────
  if (pun.prevAvg != null) {
    const prevM   = m === 0 ? 11 : m - 1;
    const prevY   = m === 0 ? y - 1 : y;
    html = html.replace(
      /id="pun-prev-label">[^<]+</,
      `id="pun-prev-label">PUN medio ${MONTH_CAP[prevM].toLowerCase()} ${prevY}<`
    );
    html = html.replace(
      /id="pun-prev-value">[^<]+</,
      `id="pun-prev-value">${fmt(pun.prevAvg)}<`
    );
    html = html.replace(
      /id="pun-prev-sub">[^<]+</,
      `id="pun-prev-sub">€/MWh (dato definitivo)<`
    );
  }

  // ── Tabella mensile: riga mese corrente ────────────────────────────────────
  if (pun.prevAvg != null && pun.avg != null) {
    const varPct = ((pun.avg - pun.prevAvg) / pun.prevAvg * 100).toFixed(1).replace('.', ',');
    const varStr = pun.avg >= pun.prevAvg ? `+${varPct}%` : `${varPct}%`;
    html = html.replace(/id="pun-table-month">[^<]+</, `id="pun-table-month">${MONTH_CAP[m]} ${y}<`);
    html = html.replace(/id="pun-table-avg">[^<]+</, `id="pun-table-avg">${fmt(pun.avg)}*<`);
    html = html.replace(/id="pun-table-var">[^<]+</, `id="pun-table-var">${varStr}<`);
    html = html.replace(/id="pun-table-note">[^<]+</, `id="pun-table-note">*Dato parziale al ${dayStr}<`);
  }

  // ── F1/F2/F3 ──────────────────────────────────────────────────────────────
  if (data.punFascia) {
    const ff = data.punFascia;
    if (ff.F1 != null) html = html.replace(/id="f1-value">[^<]+</, `id="f1-value">${fmt(ff.F1)}<`);
    if (ff.F2 != null) html = html.replace(/id="f2-value">[^<]+</, `id="f2-value">${fmt(ff.F2)}<`);
    if (ff.F3 != null) html = html.replace(/id="f3-value">[^<]+</, `id="f3-value">${fmt(ff.F3)}<`);
  }

  // ── dateModified nel JSON-LD ───────────────────────────────────────────────
  html = html.replace(
    /"dateModified":\s*"[\d-]+"/,
    `"dateModified": "${todayISO}"`
  );

  // ── Fallback statico nel JS (evita che il client JS usi valori vecchi) ─────
  if (pun.avg != null) {
    html = html.replace(
      /_buildPunChart\(\['Gen','Feb','Mar','Apr'\],\[[^\]]+\],\[[^\]]+\]\);/,
      `// dati iniettati server-side — il chart JS li sovrascriverà con i dati live`
    );
  }

  return new Response(html, {
    status:  response.status,
    headers: response.headers,
  });
};

export const config = { path: '/pun-oggi/' };
