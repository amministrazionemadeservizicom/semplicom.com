// energy-prices.js — SempliCom
// PUN + PSV + F1/F2/F3 + Prezzi zonali + PSV daily
// Fonti: GME (auth) + energy-charts.info (no-auth, zone IT)

const zlib = require('zlib');

const GME_BASE = 'https://api.mercatoelettrico.org/request';
const GME_USER = process.env.GME_USERNAME || 'madesrls3274';
const GME_PASS = process.env.GME_PASSWORD || 'dRwPUb!DqnAki4x!';
const MONTH_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// Sei zone MGP italiane con codice BZN energy-charts.info
const ZONE_CFG = [
  { key: 'nord',  name: 'Nord',        bzn: 'IT-North'   },
  { key: 'cnord', name: 'Centro-Nord', bzn: 'IT-CNORTH'  },
  { key: 'csud',  name: 'Centro-Sud',  bzn: 'IT-CSOUTH'  },
  { key: 'sud',   name: 'Sud',         bzn: 'IT-South'   },
  { key: 'sic',   name: 'Sicilia',     bzn: 'IT-Sicily'  },
  { key: 'sar',   name: 'Sardegna',    bzn: 'IT-Sardinia'},
];

function pad(n)     { return String(n).padStart(2, '0'); }
function round1(n)  { return Math.round(n * 10) / 10; }
function gmeDate(d) { return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`; }

function fetchT(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function unzipB64(b64) {
  const buf    = Buffer.from(b64, 'base64');
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('Not a ZIP');
  const method = buf.readUInt16LE(8);
  const fnLen  = buf.readUInt16LE(26);
  const exLen  = buf.readUInt16LE(28);
  const data   = buf.slice(30 + fnLen + exLen);
  return (method === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
}

async function gmeAuth() {
  const res  = await fetchT(`${GME_BASE}/api/v1/Auth`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ Login: GME_USER, Password: GME_PASS }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('Auth failed: ' + json.reason);
  return json.token;
}

async function gmeReq(token, segment, dataName, start, end) {
  const res  = await fetchT(`${GME_BASE}/api/v1/RequestData`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ Platform: 'PublicMarketResults', Segment: segment,
                              DataName: dataName, IntervalStart: start, IntervalEnd: end, Attributes: {} }),
  });
  const json = await res.json();
  if (!json.contentResponse) throw new Error('No content');
  return JSON.parse(unzipB64(json.contentResponse));
}

// ── Classifica ora in fascia ARERA (semplificata, senza festività) ──────────
// dow: 0=Dom, 1=Lun … 6=Sab   hour: 0-23 ora locale italiana
function getFascia(dow, hour) {
  if (dow >= 1 && dow <= 5) {            // Lunedì–Venerdì
    if (hour >= 8  && hour <= 18) return 'F1';
    if (hour === 7 || (hour >= 19 && hour <= 22)) return 'F2';
    return 'F3';
  }
  if (dow === 6) {                       // Sabato
    if (hour >= 7 && hour <= 22) return 'F2';
    return 'F3';
  }
  return 'F3';                           // Domenica
}

// Calcola medie F1/F2/F3 da payload energy-charts.info
function calcFascia(ecData, offsetHours) {
  if (!ecData || !ecData.unix_seconds || !ecData.price) return null;
  const buckets = { F1: [], F2: [], F3: [] };
  const ts  = ecData.unix_seconds;
  const pr  = ecData.price;
  for (let i = 0; i < ts.length; i++) {
    if (pr[i] == null) continue;
    // Simula ora locale sommando offset al timestamp, poi legge UTC
    const shifted = new Date((ts[i] + offsetHours * 3600) * 1000);
    const f = getFascia(shifted.getUTCDay(), shifted.getUTCHours());
    buckets[f].push(pr[i]);
  }
  const avg = arr => arr.length ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  return { F1: avg(buckets.F1), F2: avg(buckets.F2), F3: avg(buckets.F3),
           source: 'energy-charts.info' };
}

// ── Media su array di prezzi ─────────────────────────────────────────────────
function priceStats(prices) {
  const clean = prices.filter(p => p != null);
  if (!clean.length) return null;
  return {
    avg: round1(clean.reduce((a, b) => a + b, 0) / clean.length),
    min: round1(Math.min(...clean)),
    max: round1(Math.max(...clean)),
  };
}

exports.handler = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type':  'application/json',
    // Cache sul CDN Netlify per 6 ore; se la funzione fallisce/è lenta
    // serve i dati stale fino a 24h senza bloccare il visitatore
    'Cache-Control': 's-maxage=21600, stale-while-revalidate=86400',
  };

  const now        = new Date();
  const y          = now.getFullYear();
  const m          = now.getMonth();           // 0-based
  const prevD      = new Date(y, m - 1, 1);
  const py         = prevD.getFullYear();
  const pm         = prevD.getMonth();
  const yearStart  = gmeDate(new Date(y, 0, 1));
  const today      = gmeDate(now);
  const todayISO   = `${y}-${pad(m+1)}-${pad(now.getDate())}`;
  const monthStart = `${y}-${pad(m+1)}-01`;
  // DST Italia: UTC+2 da fine marzo a fine ottobre, UTC+1 resto
  const itOffset   = (m >= 2 && m <= 9) ? 2 : 1;

  // ── Avvia tutte le fetch in parallelo ────────────────────────────────────
  // Task 0: GME (richiede auth)
  const gmeTask = (async () => {
    const token = await gmeAuth();
    const [psvAll, punAll] = await Promise.all([
      gmeReq(token, 'MGP-GAS', 'GAS_ContinuousTrading', yearStart, today).catch(() => []),
      gmeReq(token, 'MGP',     'ME_EuropeanExchanges',  yearStart, today).catch(() => []),
    ]);
    return { psvAll, punAll };
  })();

  // Task 1…6: prezzi orari per zona corrente (energy-charts.info)
  const ecTasks = ZONE_CFG.map(z =>
    fetchT(`https://api.energy-charts.info/price?bzn=${z.bzn}&start=${monthStart}&end=${todayISO}`, {}, 6000)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  );

  const allResults = await Promise.allSettled([gmeTask, ...ecTasks]);

  // ── Estrai risultati ─────────────────────────────────────────────────────
  const gmeResult = allResults[0];
  const psvAll    = gmeResult.status === 'fulfilled' ? (gmeResult.value?.psvAll || []) : [];
  const punAll    = gmeResult.status === 'fulfilled' ? (gmeResult.value?.punAll || []) : [];
  if (gmeResult.status === 'rejected') console.error('GME:', gmeResult.reason?.message);

  const ecDataMap = {};
  for (let i = 0; i < ZONE_CFG.length; i++) {
    const r = allResults[i + 1];
    if (r.status === 'fulfilled' && r.value) ecDataMap[ZONE_CFG[i].key] = r.value;
  }

  // ── PSV: raggruppa per mese ───────────────────────────────────────────────
  let pun = null, psv = null, psvMonthly = null, punMonthly = null;

  const psvByMonth = {};
  for (const r of psvAll) {
    const price = parseFloat(r.AveragePrice);
    if (!isNaN(price) && price > 0) {
      const mk = r.FlowDate.slice(0, 6);
      if (!psvByMonth[mk]) psvByMonth[mk] = [];
      psvByMonth[mk].push(price);
    }
  }

  const psvKeys = Object.keys(psvByMonth).sort();
  if (psvKeys.length > 0) {
    psvMonthly = psvKeys.map((mk, i) => {
      const prices  = psvByMonth[mk];
      const avg     = round1(prices.reduce((a, b) => a + b, 0) / prices.length);
      const min     = round1(Math.min(...prices));
      const max     = round1(Math.max(...prices));
      const mIdx    = parseInt(mk.slice(4, 6), 10) - 1;
      const prevP   = i > 0 ? psvByMonth[psvKeys[i - 1]] : null;
      const prevAvg = prevP ? round1(prevP.reduce((a, b) => a + b, 0) / prevP.length) : null;
      const partial = mk === `${y}${pad(m + 1)}`;
      return { month: MONTH_IT[mIdx], year: parseInt(mk.slice(0, 4), 10),
               avg, min, max, prevAvg, partial };
    });

    const cur  = psvMonthly[psvMonthly.length - 1];
    const prev = psvMonthly.length > 1 ? psvMonthly[psvMonthly.length - 2] : null;
    psv = { avg: cur.avg, min: cur.min, max: cur.max,
            prevAvg: prev ? prev.avg : null, live: true, source: 'GME MGP-GAS' };
  }

  // ── PSV Daily: ultimi 60 giorni ───────────────────────────────────────────
  const psvDaily = psvAll.length > 0
    ? psvAll
        .filter(r => r.AveragePrice && parseFloat(r.AveragePrice) > 0)
        .map(r => {
          const fd = r.FlowDate; // YYYYMMDD
          return { date: fd.slice(6, 8) + '/' + fd.slice(4, 6),
                   fd, value: round1(parseFloat(r.AveragePrice)) };
        })
        .sort((a, b) => a.fd.localeCompare(b.fd))
        .slice(-60)
        .map(({ date, value }) => ({ date, value }))
    : null;

  // ── PUN: record mensili da ME_EuropeanExchanges ───────────────────────────
  if (punAll.length > 0) {
    const punByMonth = {};
    for (const r of punAll) {
      if (r.Ipex_Pun) punByMonth[String(r.ReferencePeriod)] = parseFloat(r.Ipex_Pun);
    }
    const punKeys = Object.keys(punByMonth).sort();
    if (punKeys.length > 0) {
      punMonthly = punKeys.map((mk, i) => {
        const avg     = round1(punByMonth[mk]);
        const mIdx    = parseInt(mk.slice(4, 6), 10) - 1;
        const prevAvg = i > 0 ? round1(punByMonth[punKeys[i - 1]]) : null;
        const partial = mk === `${y}${pad(m + 1)}`;
        return { month: MONTH_IT[mIdx], year: parseInt(mk.slice(0, 4), 10),
                 avg, min: null, max: null, prevAvg, partial };
      });

      const cur  = punMonthly[punMonthly.length - 1];
      const prev = punMonthly.length > 1 ? punMonthly[punMonthly.length - 2] : null;
      pun = { avg: cur.avg, min: null, max: null,
              prevAvg: prev ? prev.avg : null, live: true, source: 'GME IPEX-PUN' };
    }
  }

  // ── F1/F2/F3: da prezzi orari zona Nord ──────────────────────────────────
  const punFascia = ecDataMap.nord ? calcFascia(ecDataMap.nord, itOffset) : null;

  // ── Prezzi zonali: medie mensili per zona ─────────────────────────────────
  const zonalData = {};
  for (const z of ZONE_CFG) {
    const d = ecDataMap[z.key];
    if (!d || !d.price) continue;
    const stats = priceStats(d.price);
    if (stats) zonalData[z.key] = { name: z.name, ...stats };
  }
  const zonal = Object.keys(zonalData).length > 0 ? zonalData : null;

  // ── Fallback PUN: riusa dati Nord già fetchati se disponibili ─────────────
  if (!pun && ecDataMap.nord) {
    const stats = priceStats(ecDataMap.nord.price || []);
    if (stats) {
      // Mese precedente per delta
      let prevAvg = null;
      try {
        const ps  = `${py}-${pad(pm+1)}-01`;
        const pe  = `${y}-${pad(m+1)}-01`;
        const pr  = await fetchT(`https://api.energy-charts.info/price?bzn=IT-North&start=${ps}&end=${pe}`, {}, 5000);
        if (pr.ok) {
          const pd = await pr.json();
          const pp = (pd.price || []).filter(p => p != null);
          if (pp.length) prevAvg = round1(pp.reduce((a, b) => a + b, 0) / pp.length);
        }
      } catch (_) {}
      pun = { ...stats, prevAvg, live: true, source: 'ENTSO-E energy-charts.info' };
    }
  }

  // ── Fallback PUN diretto (se GME e cache Nord falliscono) ─────────────────
  if (!pun) {
    try {
      const cs = `${y}-${pad(m+1)}-01`;
      const ps = `${py}-${pad(pm+1)}-01`;
      const pe = `${y}-${pad(m+1)}-01`;
      const [cr, pr] = await Promise.all([
        fetchT(`https://api.energy-charts.info/price?bzn=IT-North&start=${cs}&end=${todayISO}`),
        fetchT(`https://api.energy-charts.info/price?bzn=IT-North&start=${ps}&end=${pe}`),
      ]);
      if (cr.ok) {
        const cd  = await cr.json();
        const cp  = (cd.price || []).filter(p => p != null);
        if (cp.length > 0) {
          let prevAvg = null;
          if (pr.ok) {
            const pd = await pr.json();
            const pp = (pd.price || []).filter(p => p != null);
            if (pp.length) prevAvg = round1(pp.reduce((a, b) => a + b, 0) / pp.length);
          }
          pun = { avg: round1(cp.reduce((a, b) => a + b, 0) / cp.length),
                  min: round1(Math.min(...cp)), max: round1(Math.max(...cp)),
                  prevAvg, live: true, source: 'ENTSO-E energy-charts.info' };
        }
      }
    } catch (e) { console.error('energy-charts fallback:', e.message); }
  }

  // ── Fallback statico di emergenza ─────────────────────────────────────────
  if (!pun) pun = { avg: 128.0, min: null, max: null, prevAvg: 143.4, live: false, source: 'fallback' };
  if (!psv) psv = { avg: 48.3,  min: 42.0, max: 53.7, prevAvg: 53.6,  live: false, source: 'fallback' };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      lastUpdated:  todayISO,
      currentMonth: MONTH_IT[m],  currentYear: y,
      prevMonth:    MONTH_IT[pm], prevYear:    py,
      dayOfMonth:   now.getDate(),
      pun, psv,
      psvMonthly, punMonthly,
      psvDaily,    // array {date:'DD/MM', value} ultimi 60gg
      punFascia,   // {F1, F2, F3, source} medie mensili €/MWh
      zonal,       // {nord:{name,avg,min,max}, cnord, csud, sud, sic, sar}
    }),
  };
};
