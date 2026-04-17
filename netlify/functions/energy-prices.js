// energy-prices.js — SempliCom
// PUN + PSV live da API ufficiale GME, fallback energy-charts.info

const zlib = require('zlib');

const GME_BASE  = 'https://api.mercatoelettrico.org/request';
const GME_USER  = process.env.GME_USERNAME || 'madesrls3274';
const GME_PASS  = process.env.GME_PASSWORD || 'dRwPUb!DqnAki4x!';
const MONTH_IT  = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function pad(n)      { return String(n).padStart(2, '0'); }
function round1(n)   { return Math.round(n * 10) / 10; }
function gmeDate(d)  { return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`; }

// fetch con timeout (ms)
function fetchT(url, opts = {}, ms = 6000) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// Decomprime base64-ZIP → stringa UTF-8
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Login: GME_USER, Password: GME_PASS }),
  });
  const json = await res.json();
  if (!json.success) throw new Error('Auth failed: ' + json.reason);
  return json.token;
}

async function gmeReq(token, segment, dataName, start, end) {
  const res  = await fetchT(`${GME_BASE}/api/v1/RequestData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ Platform: 'PublicMarketResults', Segment: segment,
                           DataName: dataName, IntervalStart: start, IntervalEnd: end, Attributes: {} }),
  });
  const json = await res.json();
  if (!json.contentResponse) throw new Error('No content');
  return JSON.parse(unzipB64(json.contentResponse));
}

exports.handler = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  };

  const now       = new Date();
  const y         = now.getFullYear();
  const m         = now.getMonth();          // 0-based
  const prevD     = new Date(y, m - 1, 1);
  const py        = prevD.getFullYear();
  const pm        = prevD.getMonth();

  const mStart    = gmeDate(new Date(y, m, 1));
  const today     = gmeDate(now);
  const pStart    = gmeDate(new Date(py, pm, 1));
  const pEnd      = gmeDate(new Date(y, m, 0));
  const todayISO  = `${y}-${pad(m+1)}-${pad(now.getDate())}`;

  let pun = null;
  let psv = null;

  // ── GME API ─────────────────────────────────────────────────────────────
  try {
    const token = await gmeAuth();

    // Tutte e 4 le richieste in parallelo
    const [psvCur, psvPrev, punCur, punPrev] = await Promise.all([
      gmeReq(token, 'MGP-GAS', 'GAS_ContinuousTrading',  mStart, today).catch(() => []),
      gmeReq(token, 'MGP-GAS', 'GAS_ContinuousTrading',  pStart, pEnd).catch(() => []),
      gmeReq(token, 'MGP',     'ME_EuropeanExchanges',   mStart, today).catch(() => []),
      gmeReq(token, 'MGP',     'ME_EuropeanExchanges',   pStart, pEnd).catch(() => []),
    ]);

    // PSV — media giornaliera di AveragePrice
    const psvPrices = psvCur.map(r => parseFloat(r.AveragePrice)).filter(p => p > 0);
    if (psvPrices.length > 0) {
      const pp = psvPrev.map(r => parseFloat(r.AveragePrice)).filter(p => p > 0);
      psv = {
        avg:     round1(psvPrices.reduce((a, b) => a + b, 0) / psvPrices.length),
        min:     round1(Math.min(...psvPrices)),
        max:     round1(Math.max(...psvPrices)),
        prevAvg: pp.length ? round1(pp.reduce((a, b) => a + b, 0) / pp.length) : null,
        live: true, source: 'GME MGP-GAS',
      };
    }

    // PUN — Ipex_Pun mensile
    const curKey  = `${y}${pad(m+1)}`;
    const prevKey = `${py}${pad(pm+1)}`;
    const cRec    = [...punCur, ...punPrev].find(r => String(r.ReferencePeriod) === curKey);
    const pRec    = [...punPrev, ...punCur].find(r => String(r.ReferencePeriod) === prevKey);
    if (cRec?.Ipex_Pun) {
      pun = { avg: round1(parseFloat(cRec.Ipex_Pun)), min: null, max: null,
              prevAvg: pRec ? round1(parseFloat(pRec.Ipex_Pun)) : null,
              live: true, source: 'GME IPEX-PUN' };
    }

  } catch (e) { console.error('GME error:', e.message); }

  // ── Fallback PUN: energy-charts.info ────────────────────────────────────
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
        const cd = await cr.json();
        const cp = (cd.price || []).filter(p => p != null);
        if (cp.length > 0) {
          let prevAvg = null;
          if (pr.ok) { const pd = await pr.json(); const pp = (pd.price||[]).filter(p=>p!=null);
            if (pp.length) prevAvg = round1(pp.reduce((a,b)=>a+b,0)/pp.length); }
          pun = { avg: round1(cp.reduce((a,b)=>a+b,0)/cp.length),
                  min: round1(Math.min(...cp)), max: round1(Math.max(...cp)),
                  prevAvg, live: true, source: 'ENTSO-E energy-charts.info' };
        }
      }
    } catch(e) { console.error('energy-charts error:', e.message); }
  }

  // ── Dati statici di emergenza ────────────────────────────────────────────
  if (!pun) pun = { avg:125.4, min:101.2, max:148.7, prevAvg:118.3, live:false, source:'fallback' };
  if (!psv) psv = { avg:38.2,  min:34.7,  max:42.1,  prevAvg:40.5,  live:false, source:'fallback' };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      lastUpdated: todayISO,
      currentMonth: MONTH_IT[m],  currentYear: y,
      prevMonth: MONTH_IT[pm],    prevYear: py,
      dayOfMonth: now.getDate(),
      pun, psv,
    }),
  };
};
