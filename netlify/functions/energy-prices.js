// energy-prices.js — SempliCom
// Fetches live PUN and PSV data from GME official API (api.mercatoelettrico.org)
// Fallback: energy-charts.info (ENTSO-E) for PUN, static data for PSV

const zlib = require('zlib');

const GME_BASE = 'https://api.mercatoelettrico.org/request';
const MONTH_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function pad(n) { return String(n).padStart(2, '0'); }
function round1(n) { return Math.round(n * 10) / 10; }

function toGMEDate(d) {
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
}

// Decompress base64-encoded ZIP and return first file content as string
function unzipB64(b64) {
  const buf = Buffer.from(b64, 'base64');
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('Not a ZIP');
  const method    = buf.readUInt16LE(8);
  const fnLen     = buf.readUInt16LE(26);
  const extraLen  = buf.readUInt16LE(28);
  const dataStart = 30 + fnLen + extraLen;
  const compressed = buf.slice(dataStart);
  return (method === 8 ? zlib.inflateRawSync(compressed) : compressed).toString('utf8');
}

// Authenticate and get JWT token
async function gmeAuth() {
  const res = await fetch(`${GME_BASE}/api/v1/Auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Login: process.env.GME_USERNAME,
      Password: process.env.GME_PASSWORD,
    }),
  });
  const json = await res.json();
  if (!json.Success) throw new Error('GME auth failed: ' + json.Reason);
  return json.token;
}

// Generic data request
async function gmeRequest(token, segment, dataName, start, end) {
  const res = await fetch(`${GME_BASE}/api/v1/RequestData`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      Platform: 'PublicMarketResults',
      Segment: segment,
      DataName: dataName,
      IntervalStart: start,
      IntervalEnd: end,
      Attributes: {},
    }),
  });
  const json = await res.json();
  if (!json.ContentResponse) throw new Error('GME no content: ' + json.ResultRequest);
  return JSON.parse(unzipB64(json.ContentResponse));
}

exports.handler = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  };

  const now        = new Date();
  const year       = now.getFullYear();
  const month      = now.getMonth(); // 0-based
  const prevD      = new Date(year, month - 1, 1);
  const prevYear   = prevD.getFullYear();
  const prevMonth  = prevD.getMonth();

  const monthStart    = toGMEDate(new Date(year, month, 1));
  const today         = toGMEDate(now);
  const prevStart     = toGMEDate(new Date(prevYear, prevMonth, 1));
  const prevEnd       = toGMEDate(new Date(year, month, 0)); // last day of prev month
  const todayISO      = `${year}-${pad(month+1)}-${pad(now.getDate())}`;

  let punData = null;
  let psvData = null;

  // ── GME API ──────────────────────────────────────────────────────────────
  if (process.env.GME_USERNAME && process.env.GME_PASSWORD) {
    try {
      const token = await gmeAuth();

      // PSV: GAS_ContinuousTrading / MGP-GAS — daily AveragePrice
      try {
        const [psvCur, psvPrev] = await Promise.all([
          gmeRequest(token, 'MGP-GAS', 'GAS_ContinuousTrading', monthStart, today),
          gmeRequest(token, 'MGP-GAS', 'GAS_ContinuousTrading', prevStart, prevEnd),
        ]);

        const toAvg = (rows) => rows
          .map(r => r.AveragePrice)
          .filter(p => p != null && p > 0);

        const curPrices = toAvg(psvCur);
        if (curPrices.length > 0) {
          psvData = {
            avg:     round1(curPrices.reduce((a, b) => a + b, 0) / curPrices.length),
            min:     round1(Math.min(...curPrices)),
            max:     round1(Math.max(...curPrices)),
            prevAvg: null,
            live:    true,
            source:  'GME MGP-GAS',
          };
          const prevPrices = toAvg(psvPrev);
          if (prevPrices.length > 0)
            psvData.prevAvg = round1(prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length);
        }
      } catch (e) { console.error('PSV fetch error:', e.message); }

      // PUN: ME_EuropeanExchanges / MGP — monthly Ipex_Pun
      try {
        const [punCur, punPrev] = await Promise.all([
          gmeRequest(token, 'MGP', 'ME_EuropeanExchanges', monthStart, today),
          gmeRequest(token, 'MGP', 'ME_EuropeanExchanges', prevStart, prevEnd),
        ]);

        const curKey  = `${year}${pad(month+1)}`;
        const prevKey = `${prevYear}${pad(prevMonth+1)}`;
        const curRec  = punCur.find(r => String(r.ReferencePeriod) === curKey);
        const prevRec = [...punPrev, ...punCur].find(r => String(r.ReferencePeriod) === prevKey);

        if (curRec && curRec.Ipex_Pun) {
          punData = {
            avg:     round1(curRec.Ipex_Pun),
            min:     null,
            max:     null,
            prevAvg: prevRec ? round1(prevRec.Ipex_Pun) : null,
            live:    true,
            source:  'GME IPEX-PUN',
          };
        }
      } catch (e) { console.error('PUN GME fetch error:', e.message); }

    } catch (e) { console.error('GME auth error:', e.message); }
  }

  // ── Fallback PUN: energy-charts.info (ENTSO-E) ───────────────────────────
  if (!punData) {
    try {
      const curStart  = `${year}-${pad(month+1)}-01`;
      const prevStart2 = `${prevYear}-${pad(prevMonth+1)}-01`;
      const prevEnd2   = `${year}-${pad(month+1)}-01`;

      const [curRes, prevRes] = await Promise.all([
        fetch(`https://api.energy-charts.info/price?bzn=IT&start=${curStart}&end=${todayISO}`),
        fetch(`https://api.energy-charts.info/price?bzn=IT&start=${prevStart2}&end=${prevEnd2}`),
      ]);

      if (curRes.ok) {
        const cur = await curRes.json();
        const prices = (cur.price || []).filter(p => p != null);
        if (prices.length > 0) {
          let prevAvg = null;
          if (prevRes.ok) {
            const prev = await prevRes.json();
            const pp = (prev.price || []).filter(p => p != null);
            if (pp.length > 0) prevAvg = round1(pp.reduce((a, b) => a + b, 0) / pp.length);
          }
          punData = {
            avg:     round1(prices.reduce((a, b) => a + b, 0) / prices.length),
            min:     round1(Math.min(...prices)),
            max:     round1(Math.max(...prices)),
            prevAvg,
            live:    true,
            source:  'ENTSO-E energy-charts.info',
          };
        }
      }
    } catch (e) { console.error('energy-charts fallback error:', e.message); }
  }

  // ── Static fallback ───────────────────────────────────────────────────────
  if (!punData) punData = { avg: 125.4, min: 101.2, max: 148.7, prevAvg: 118.3, live: false, source: 'dati in aggiornamento' };
  if (!psvData) psvData = { avg: 38.2,  min: 34.7,  max: 42.1,  prevAvg: 40.5,  live: false, source: 'dati in aggiornamento' };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      lastUpdated:   todayISO,
      currentMonth:  MONTH_IT[month],
      currentYear:   year,
      prevMonth:     MONTH_IT[prevMonth],
      prevYear,
      dayOfMonth:    now.getDate(),
      pun:           punData,
      psv:           psvData,
    }),
  };
};
