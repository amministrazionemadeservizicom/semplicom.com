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
    'Cache-Control': 'no-cache',
  };

  const now       = new Date();
  const y         = now.getFullYear();
  const m         = now.getMonth();          // 0-based
  const prevD     = new Date(y, m - 1, 1);
  const py        = prevD.getFullYear();
  const pm        = prevD.getMonth();

  const yearStart = gmeDate(new Date(y, 0, 1));  // 1 gennaio anno corrente
  const today     = gmeDate(now);
  const todayISO  = `${y}-${pad(m+1)}-${pad(now.getDate())}`;

  let pun = null;
  let psv = null;
  let psvMonthly = null;
  let punMonthly = null;

  // ── GME API ─────────────────────────────────────────────────────────────
  try {
    const token = await gmeAuth();

    const [psvAll, punAll] = await Promise.all([
      gmeReq(token, 'MGP-GAS', 'GAS_ContinuousTrading', yearStart, today).catch(() => []),
      gmeReq(token, 'MGP',     'ME_EuropeanExchanges',  yearStart, today).catch(() => []),
    ]);

    // ── PSV: raggruppa per mese ──────────────────────────────────────────
    const psvByMonth = {};
    for (const r of psvAll) {
      const price = parseFloat(r.AveragePrice);
      if (!isNaN(price) && price > 0) {
        const mk = r.FlowDate.slice(0, 6); // YYYYMM
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
        const prevPrices = i > 0 ? psvByMonth[psvKeys[i - 1]] : null;
        const prevAvg = prevPrices
          ? round1(prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length)
          : null;
        const partial = mk === `${y}${pad(m + 1)}`;
        return { month: MONTH_IT[mIdx], year: parseInt(mk.slice(0, 4), 10), avg, min, max, prevAvg, partial };
      });

      const cur  = psvMonthly[psvMonthly.length - 1];
      const prev = psvMonthly.length > 1 ? psvMonthly[psvMonthly.length - 2] : null;
      psv = { avg: cur.avg, min: cur.min, max: cur.max,
              prevAvg: prev ? prev.avg : null, live: true, source: 'GME MGP-GAS' };
    }

    // ── PUN: record mensili da ME_EuropeanExchanges ──────────────────────
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
          return { month: MONTH_IT[mIdx], year: parseInt(mk.slice(0, 4), 10), avg, min: null, max: null, prevAvg, partial };
        });

        const cur  = punMonthly[punMonthly.length - 1];
        const prev = punMonthly.length > 1 ? punMonthly[punMonthly.length - 2] : null;
        pun = { avg: cur.avg, min: null, max: null,
                prevAvg: prev ? prev.avg : null, live: true, source: 'GME IPEX-PUN' };
      }
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
  if (!pun) pun = { avg:128.0, min:null, max:null, prevAvg:143.4, live:false, source:'fallback' };
  if (!psv) psv = { avg:48.3,  min:42.0, max:53.7, prevAvg:53.6,  live:false, source:'fallback' };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      lastUpdated: todayISO,
      currentMonth: MONTH_IT[m],  currentYear: y,
      prevMonth: MONTH_IT[pm],    prevYear: py,
      dayOfMonth: now.getDate(),
      pun, psv, psvMonthly, punMonthly,
    }),
  };
};
