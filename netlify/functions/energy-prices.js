// energy-prices.js
// Netlify Function — returns PUN and PSV price data
// PUN (electricity): fetched live from energy-charts.info (ENTSO-E transparency data)
// PSV (gas): estimated based on stored monthly reference values

const MONTH_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// PSV reference values (€/MWh) — update monthly
// Source: GME / ARERA
const PSV_MONTHLY = {
  '2026-01': { avg: 48.3, label: 'Picco stagionale invernale' },
  '2026-02': { avg: 44.7, label: 'Calo fine inverno' },
  '2026-03': { avg: 40.5, label: 'Riscaldamento ridotto' },
  '2026-04': { avg: null, label: 'Dato in aggiornamento' }, // filled dynamically
};

// PSV April 2026 partial data (min/max from GME weekly reports)
const PSV_CURRENT_PARTIAL = { min: 34.7, max: 42.1, minDay: 15, maxDay: 3 };

function pad(n) { return String(n).padStart(2, '0'); }

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function round1(n) { return Math.round(n * 10) / 10; }

exports.handler = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600', // cache 1h
  };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const today = toDateStr(now);

  const monthStart = `${year}-${pad(month+1)}-01`;

  // Previous month
  const prevMonthDate = new Date(year, month - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth(); // 0-based
  const prevMonthStart = `${prevYear}-${pad(prevMonth+1)}-01`;
  const prevMonthEnd = monthStart; // exclusive end = current month start

  // ---- Fetch PUN (electricity) from energy-charts.info ----
  let punData = null;
  try {
    const baseUrl = 'https://api.energy-charts.info/price';
    const [curRes, prevRes] = await Promise.all([
      fetch(`${baseUrl}?bzn=IT&start=${monthStart}&end=${today}`),
      fetch(`${baseUrl}?bzn=IT&start=${prevMonthStart}&end=${prevMonthEnd}`),
    ]);

    if (curRes.ok) {
      const cur = await curRes.json();
      const prices = (cur.price || []).filter(p => p != null);

      if (prices.length > 0) {
        const avg = round1(prices.reduce((a, b) => a + b, 0) / prices.length);
        const min = round1(Math.min(...prices));
        const max = round1(Math.max(...prices));

        let prevAvg = null;
        if (prevRes.ok) {
          const prev = await prevRes.json();
          const prevPrices = (prev.price || []).filter(p => p != null);
          if (prevPrices.length > 0)
            prevAvg = round1(prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length);
        }

        punData = { avg, min, max, prevAvg, source: 'ENTSO-E / energy-charts.info', live: true };
      }
    }
  } catch (e) {
    console.error('PUN fetch error:', e.message);
  }

  // Fallback if API unreachable
  if (!punData) {
    punData = {
      avg: 125.4, min: 101.2, max: 148.7, prevAvg: 118.3,
      source: 'dati in aggiornamento', live: false,
    };
  }

  // ---- PSV (gas) — use stored monthly data + partial for current month ----
  const curMonthKey = `${year}-${pad(month+1)}`;
  const prevMonthKey = `${prevYear}-${pad(prevMonth+1)}`;

  const psvStored = PSV_MONTHLY[curMonthKey];
  const psvPrevStored = PSV_MONTHLY[prevMonthKey];

  // Compute partial average: if no stored avg for current month, estimate from partial data
  const psvAvg = psvStored?.avg ?? round1((PSV_CURRENT_PARTIAL.min + PSV_CURRENT_PARTIAL.max) / 2);
  const psvMin = PSV_CURRENT_PARTIAL.min;
  const psvMax = PSV_CURRENT_PARTIAL.max;
  const psvMinDay = PSV_CURRENT_PARTIAL.minDay;
  const psvMaxDay = PSV_CURRENT_PARTIAL.maxDay;
  const psvPrevAvg = psvPrevStored?.avg ?? null;

  // ---- Build response ----
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      lastUpdated: today,
      currentMonth: MONTH_IT[month],
      currentYear: year,
      prevMonth: MONTH_IT[prevMonth],
      prevYear,
      dayOfMonth: now.getDate(),
      pun: {
        avg: punData.avg,
        min: punData.min,
        max: punData.max,
        prevAvg: punData.prevAvg,
        source: punData.source,
        live: punData.live,
      },
      psv: {
        avg: psvAvg,
        min: psvMin,
        max: psvMax,
        minDay: psvMinDay,
        maxDay: psvMaxDay,
        prevAvg: psvPrevAvg,
        source: 'GME / ARERA',
        live: false,
      },
    }),
  };
};
