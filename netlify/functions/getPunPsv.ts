/**
 * Netlify Function: Prezzi PSV e PUN via API diretta GME
 * GET /.netlify/functions/getPunPsv
 *
 * Architettura:
 *   - Cache Firestore (config/gme_cache) con TTL 8 ore
 *   - Se cache fresca → risposta istantanea senza toccare GME
 *   - Se cache scaduta → chiama GME, aggiorna cache, ritorna dati
 *   - Se GME fallisce ma cache esiste → ritorna cache vecchia (meglio di niente)
 *   - Se GME fallisce e nessuna cache → fallback prezzi base da semplicom.com
 *
 * Credenziali GME:
 *   1) env var GME_LOGIN / GME_PASSWORD  (dev locale + Netlify env vars)
 *   2) Firestore config/gme { login, password }  (fallback)
 */

import { inflateRawSync } from 'zlib';
import { adminDb } from '../../utils/firebase-admin';

const GME_BASE = 'https://api.mercatoelettrico.org/request';
const CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 ore

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600',
};

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface MonthlyEntry {
  month: string; year: number;
  avg: number; min: number; max: number;
  prevAvg: number | null; partial: boolean;
}

export interface HourlyEntry {
  hour: number;   // 1–24
  price: number;  // €/MWh
}

export interface GmeEnergyData {
  cachedAt: string;        // ISO — quando i dati GME sono stati scaricati
  source: 'gme' | 'semplicom';
  currentMonth: string;
  currentYear: number;
  prevMonth: string;
  lastUpdated: string;
  pun: { avg: number; min: number; max: number; prevAvg: number; live: boolean };
  psv: { avg: number; min: number; max: number; prevAvg: number; live: boolean };
  psvMonthly: MonthlyEntry[];
  punMonthly: MonthlyEntry[] | null;
  punHourly: HourlyEntry[] | null;  // prezzi orari PUN di oggi
}

// ─── GME Auth ────────────────────────────────────────────────────────────────

async function getGmeToken(login: string, password: string): Promise<string> {
  const res = await fetch(`${GME_BASE}/api/v1/Auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Login: login, Password: password }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GME Auth HTTP ${res.status}`);
  const data = await res.json();
  const token = data.token ?? data.Token ?? data.access_token ?? data.AccessToken;
  if (!token) throw new Error(`GME Auth: nessun token: ${JSON.stringify(data).slice(0, 200)}`);
  return token;
}

// ─── ZIP decompression ───────────────────────────────────────────────────────

function unzipFirst(buf: Buffer): string {
  if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('Not a ZIP file');
  const compression = buf.readUInt16LE(8);
  let compressedSize = buf.readUInt32LE(18);
  const fnLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + fnLen + extraLen;
  if (compressedSize === 0) {
    for (let i = dataStart; i < buf.length - 4; i++) {
      const sig = buf.readUInt32LE(i);
      if (sig === 0x08074b50 || sig === 0x04034b50 || sig === 0x02014b50) {
        compressedSize = i - dataStart; break;
      }
    }
  }
  const data = buf.slice(dataStart, dataStart + compressedSize);
  if (compression === 0) return data.toString('utf8');
  if (compression === 8) return inflateRawSync(data).toString('utf8');
  throw new Error(`ZIP compression ${compression} non supportata`);
}

// ─── GME RequestData ─────────────────────────────────────────────────────────

type GmeRow = Record<string, string | number>;

async function fetchGmeRows(
  token: string, segment: string, dataName: string,
  intervalStart: number, intervalEnd: number,
): Promise<GmeRow[]> {
  const res = await fetch(`${GME_BASE}/api/v1/RequestData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      Platform: 'PublicMarketResults', Segment: segment, DataName: dataName,
      IntervalStart: intervalStart, IntervalEnd: intervalEnd, Attributes: {},
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`GME RequestData HTTP ${res.status} (${segment}/${dataName})`);
  const json = await res.json();
  const b64 = json.contentResponse ?? json.ContentResponse ?? json.content;
  if (!b64) throw new Error(`Nessun contentResponse (${segment}/${dataName})`);
  const parsed = JSON.parse(unzipFirst(Buffer.from(b64, 'base64')));
  return Array.isArray(parsed) ? parsed : (parsed.data ?? parsed.rows ?? []);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateToInt(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function parsePrice(v: unknown): number {
  if (v == null) return NaN;
  return typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
}

function pick(row: GmeRow, ...names: string[]): unknown {
  for (const n of names) {
    if (n in row) return row[n];
    const key = Object.keys(row).find(k => k.toLowerCase() === n.toLowerCase());
    if (key) return row[key];
  }
  return undefined;
}

function parseFlowDate(raw: unknown): { year: number; month: number; day: number } | null {
  if (raw == null) return null;
  const s = String(raw).replace(/-/g, '').slice(0, 8);
  if (s.length !== 8 || isNaN(Number(s))) return null;
  return { year: parseInt(s.slice(0, 4)), month: parseInt(s.slice(4, 6)), day: parseInt(s.slice(6, 8)) };
}

function rowsToMonthly(rows: GmeRow[], now: Date): MonthlyEntry[] {
  const buckets: Record<string, { sum: number; min: number; max: number; count: number; year: number; month: number }> = {};
  for (const row of rows) {
    const fd = parseFlowDate(pick(row, 'FlowDate', 'GasDate', 'Date', 'DATE', 'flowDate', 'DataRiferimento', 'Giorno'));
    if (!fd) continue;
    const avg = parsePrice(pick(row, 'AveragePrice', 'averagePrice', 'PrezzoMedio', 'Price', 'Prezzo', 'PREZZONAZIONALE', 'PUN'));
    const mn = parsePrice(pick(row, 'MinPrice', 'minPrice', 'PrezzoMin', 'Min', 'PREZZOMIN'));
    const mx = parsePrice(pick(row, 'MaxPrice', 'maxPrice', 'PrezzoMax', 'Max', 'PREZZOMAX'));
    if (isNaN(avg)) continue;
    const key = `${fd.year}-${fd.month}`;
    if (!buckets[key]) buckets[key] = { sum: 0, min: Infinity, max: -Infinity, count: 0, year: fd.year, month: fd.month };
    buckets[key].sum += avg;
    buckets[key].min = Math.min(buckets[key].min, isNaN(mn) ? avg : mn);
    buckets[key].max = Math.max(buckets[key].max, isNaN(mx) ? avg : mx);
    buckets[key].count++;
  }
  const sorted = Object.values(buckets).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const nowY = now.getFullYear(), nowM = now.getMonth() + 1;
  return sorted.map((b, i) => {
    const avg = b.sum / b.count;
    const prev = sorted[i - 1];
    return {
      month: MONTH_NAMES[b.month - 1], year: b.year,
      avg: Math.round(avg * 100) / 100,
      min: b.min === Infinity ? 0 : Math.round(b.min * 100) / 100,
      max: b.max === -Infinity ? 0 : Math.round(b.max * 100) / 100,
      prevAvg: prev ? Math.round((prev.sum / prev.count) * 100) / 100 : null,
      partial: b.year === nowY && b.month === nowM,
    };
  });
}

function latestDayPrice(rows: GmeRow[]): { avg: number; min: number; max: number } {
  let best: { year: number; month: number; day: number } | null = null;
  let bestAvg = 0, bestMin = 0, bestMax = 0;
  for (const row of rows) {
    const fd = parseFlowDate(pick(row, 'FlowDate', 'GasDate', 'Date', 'DATE', 'flowDate', 'DataRiferimento', 'Giorno'));
    if (!fd) continue;
    if (!best || fd.year > best.year || (fd.year === best.year && fd.month > best.month) ||
        (fd.year === best.year && fd.month === best.month && fd.day > best.day)) {
      best = fd;
      bestAvg = parsePrice(pick(row, 'AveragePrice', 'averagePrice', 'PrezzoMedio', 'Price', 'Prezzo', 'PREZZONAZIONALE', 'PUN')) || 0;
      bestMin = parsePrice(pick(row, 'MinPrice', 'minPrice', 'PrezzoMin', 'Min')) || bestAvg;
      bestMax = parsePrice(pick(row, 'MaxPrice', 'maxPrice', 'PrezzoMax', 'Max')) || bestAvg;
    }
  }
  return {
    avg: Math.round(bestAvg * 100) / 100,
    min: Math.round(bestMin * 100) / 100,
    max: Math.round(bestMax * 100) / 100,
  };
}

function rowsToHourly(rows: GmeRow[]): HourlyEntry[] {
  let maxDate = 0;
  for (const row of rows) {
    const fd = parseFlowDate(pick(row, 'FlowDate', 'Date', 'DATE', 'Giorno', 'DataRiferimento'));
    if (!fd) continue;
    const d = fd.year * 10000 + fd.month * 100 + fd.day;
    if (d > maxDate) maxDate = d;
  }
  if (!maxDate) return [];

  const hourly: HourlyEntry[] = [];
  for (const row of rows) {
    const fd = parseFlowDate(pick(row, 'FlowDate', 'Date', 'DATE', 'Giorno', 'DataRiferimento'));
    if (!fd) continue;
    const d = fd.year * 10000 + fd.month * 100 + fd.day;
    if (d !== maxDate) continue;
    const hour = Number(pick(row, 'ORA', 'Ora', 'Hour', 'HOUR', 'ora') ?? 0);
    const price = parsePrice(pick(row, 'PREZZONAZIONALE', 'PrezzoNazionale', 'PUN', 'Price', 'Prezzo', 'AveragePrice'));
    if (hour > 0 && !isNaN(price)) {
      hourly.push({ hour, price: Math.round(price * 100) / 100 });
    }
  }
  return hourly.sort((a, b) => a.hour - b.hour);
}

// ─── Firestore cache ─────────────────────────────────────────────────────────

async function readCache(): Promise<GmeEnergyData | null> {
  try {
    if (!adminDb) return null;
    const snap = await adminDb.collection('config').doc('gme_cache').get();
    if (!snap.exists) return null;
    const d = snap.data() as any;
    if (!d?.cachedAt) return null;
    return d as GmeEnergyData;
  } catch { return null; }
}

async function writeCache(data: GmeEnergyData): Promise<void> {
  try {
    if (!adminDb) return;
    await adminDb.collection('config').doc('gme_cache').set(data);
  } catch (e: any) {
    console.warn('Cache write error:', e.message);
  }
}

function isCacheFresh(data: GmeEnergyData): boolean {
  if (data.source === 'semplicom') return false;
  const age = Date.now() - new Date(data.cachedAt).getTime();
  return age < CACHE_TTL_MS;
}

// ─── PUN da energy-charts.info (ENTSO-E) ────────────────────────────────────

async function fetchPunFromEnergyCharts(now: Date): Promise<{
  punHourly: HourlyEntry[] | null;
  punMonthly: MonthlyEntry[] | null;
  punLatest: { avg: number; min: number; max: number };
}> {
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const url = `https://api.energy-charts.info/price?bzn=IT-North`
    + `&start=${startDate.toISOString().slice(0, 10)}T00%3A00%2B02%3A00`
    + `&end=${endDate.toISOString().slice(0, 10)}T23%3A00%2B02%3A00`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`energy-charts HTTP ${res.status}`);
  const data = await res.json();

  const timestamps: number[] = data.unix_seconds ?? [];
  const prices: (number | null)[] = data.price ?? [];
  if (!timestamps.length) return { punHourly: null, punMonthly: null, punLatest: { avg: 0, min: 0, max: 0 } };

  const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  const hourFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hour: 'numeric', hour12: false });
  const todayIT = dateFormatter.format(now);

  const hourlyMap: Record<number, number[]> = {};
  const monthlyMap: Record<string, { prices: number[]; year: number; monthNum: number }> = {};

  for (let i = 0; i < timestamps.length; i++) {
    const price = prices[i];
    if (price == null || isNaN(price)) continue;
    const dt = new Date(timestamps[i] * 1000);
    const dateIT = dateFormatter.format(dt);
    const hourIT = parseInt(hourFormatter.format(dt));
    const [yearStr, monthStr] = dateIT.split('-');
    const year = parseInt(yearStr), monthNum = parseInt(monthStr);
    const monthKey = `${year}-${monthStr}`;

    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { prices: [], year, monthNum };
    monthlyMap[monthKey].prices.push(price);

    if (dateIT === todayIT) {
      if (!hourlyMap[hourIT]) hourlyMap[hourIT] = [];
      hourlyMap[hourIT].push(price);
    }
  }

  const punHourly: HourlyEntry[] = Object.entries(hourlyMap)
    .map(([h, ps]) => ({
      hour: parseInt(h),
      price: Math.round(ps.reduce((a, b) => a + b, 0) / ps.length * 100) / 100,
    }))
    .sort((a, b) => a.hour - b.hour);

  const nowY = now.getFullYear(), nowM = now.getMonth() + 1;
  const sortedKeys = Object.keys(monthlyMap).sort();
  const punMonthly: MonthlyEntry[] = sortedKeys.map((key, idx) => {
    const { prices: ps, year, monthNum } = monthlyMap[key];
    const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
    const prevKey = sortedKeys[idx - 1];
    const prevPs = prevKey ? monthlyMap[prevKey].prices : null;
    const prevAvg = prevPs ? prevPs.reduce((a, b) => a + b, 0) / prevPs.length : null;
    return {
      month: MONTH_NAMES[monthNum - 1], year,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(Math.min(...ps) * 100) / 100,
      max: Math.round(Math.max(...ps) * 100) / 100,
      prevAvg: prevAvg != null ? Math.round(prevAvg * 100) / 100 : null,
      partial: year === nowY && monthNum === nowM,
    };
  });

  const latestPs = sortedKeys.length ? monthlyMap[sortedKeys[sortedKeys.length - 1]].prices : [];
  const latestAvg = latestPs.length ? latestPs.reduce((a, b) => a + b, 0) / latestPs.length : 0;
  const punLatest = {
    avg: Math.round(latestAvg * 100) / 100,
    min: latestPs.length ? Math.round(Math.min(...latestPs) * 100) / 100 : 0,
    max: latestPs.length ? Math.round(Math.max(...latestPs) * 100) / 100 : 0,
  };

  return {
    punHourly: punHourly.length > 0 ? punHourly : null,
    punMonthly: punMonthly.length > 0 ? punMonthly : null,
    punLatest,
  };
}

// ─── Fetch da GME ─────────────────────────────────────────────────────────────

async function fetchFromGme(login: string, password: string, now: Date): Promise<GmeEnergyData> {
  const intervalEnd = dateToInt(now);
  // Max 11 mesi indietro (GME restituisce 412 con range ≥ 12 mesi)
  const start12m = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
  const intervalStart12m = dateToInt(start12m);

  const token = await getGmeToken(login, password);

  // ── PSV mensile (11 mesi) da GME ──
  let psvRows: GmeRow[] = [];
  try {
    psvRows = await fetchGmeRows(token, 'MGP-GAS', 'GAS_ContinuousTrading', intervalStart12m, intervalEnd);
    console.log(`GAS_ContinuousTrading: ${psvRows.length} righe`);
  } catch (e: any) {
    console.warn('GAS_ContinuousTrading fallito:', e.message, '— provo GAS_PGasResults');
    try {
      psvRows = await fetchGmeRows(token, 'MGP-GAS', 'GAS_PGasResults', intervalStart12m, intervalEnd);
      console.log(`GAS_PGasResults: ${psvRows.length} righe`);
    } catch (e2: any) {
      console.warn('GAS_PGasResults fallito:', e2.message);
    }
  }

  if (psvRows.length === 0) {
    throw new Error('GME: nessun dato PSV (entrambi i segmenti vuoti o in errore)');
  }

  const psvMonthly = rowsToMonthly(psvRows, now);
  const psvLatest = latestDayPrice(psvRows);
  const psvPrevMonth = psvMonthly[psvMonthly.length - 2] ?? null;

  // ── PUN da energy-charts.info (ENTSO-E, gratuito) ──
  let punMonthly: MonthlyEntry[] | null = null;
  let punLatest = { avg: 0, min: 0, max: 0 };
  let punHourly: HourlyEntry[] | null = null;

  try {
    const pun = await fetchPunFromEnergyCharts(now);
    punMonthly = pun.punMonthly;
    punLatest = pun.punLatest;
    punHourly = pun.punHourly;
    console.log(`PUN energy-charts: ${punMonthly?.length ?? 0} mesi, hourly oggi: ${punHourly?.length ?? 0} ore`);
  } catch (e: any) {
    console.warn('PUN energy-charts fallito:', e.message);
  }

  return {
    cachedAt: now.toISOString(),
    source: 'gme',
    lastUpdated: now.toISOString(),
    currentMonth: MONTH_NAMES[now.getMonth()],
    currentYear: now.getFullYear(),
    prevMonth: MONTH_NAMES[now.getMonth() === 0 ? 11 : now.getMonth() - 1],
    psv: {
      avg: psvLatest.avg, min: psvLatest.min, max: psvLatest.max,
      prevAvg: psvPrevMonth?.avg ?? 0, live: false,
    },
    pun: punMonthly && punMonthly.length > 0 ? {
      avg: punLatest.avg, min: punLatest.min, max: punLatest.max,
      prevAvg: punMonthly.length >= 2 ? punMonthly[punMonthly.length - 2].avg : 0,
      live: false,
    } : { avg: 0, min: 0, max: 0, prevAvg: 0, live: false },
    psvMonthly,
    punMonthly: punMonthly && punMonthly.length > 0 ? punMonthly : null,
    punHourly: punHourly && punHourly.length > 0 ? punHourly : null,
  };
}

// ─── Fallback semplicom.com energy-prices ───────────────────────────────────

async function fetchEnergyPricesFallback(now: Date): Promise<GmeEnergyData> {
  const res = await fetch('https://semplicom.com/.netlify/functions/energy-prices', {
    headers: { 'User-Agent': 'SempliCom-getPunPsv/1.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`energy-prices HTTP ${res.status}`);
  const d = await res.json();
  return {
    cachedAt: now.toISOString(),
    source: 'semplicom',
    lastUpdated: d.lastUpdated ?? now.toISOString(),
    currentMonth: d.currentMonth ?? MONTH_NAMES[now.getMonth()],
    currentYear: d.currentYear ?? now.getFullYear(),
    prevMonth: d.prevMonth ?? MONTH_NAMES[now.getMonth() === 0 ? 11 : now.getMonth() - 1],
    pun: d.pun ?? { avg: 0, min: 0, max: 0, prevAvg: 0, live: false },
    psv: d.psv ?? { avg: 0, min: 0, max: 0, prevAvg: 0, live: false },
    psvMonthly: d.psvMonthly ?? [],
    punMonthly: d.punMonthly ?? null,
    punHourly: null,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: HEADERS });

  const now = new Date();

  // 1) Cache fresca → risposta istantanea
  const cached = await readCache();
  if (cached && isCacheFresh(cached)) {
    console.log('getPunPsv: cache fresca');
    return new Response(JSON.stringify(cached), { status: 200, headers: HEADERS });
  }

  // 2) Credenziali GME (env var prima, poi Firestore)
  let login = process.env.GME_LOGIN || process.env.GME_USERNAME;
  let password = process.env.GME_PASSWORD;
  if (!login || !password) {
    try {
      if (adminDb) {
        const snap = await adminDb.collection('config').doc('gme').get();
        const cfg = snap.data();
        login = login || cfg?.login || cfg?.GME_LOGIN;
        password = password || cfg?.password || cfg?.GME_PASSWORD;
      }
    } catch (e: any) {
      console.warn('Firestore config/gme non leggibile:', e.message);
    }
  }

  // 3) Fetch parallelo: GME (PSV) + energy-charts (PUN) + fallback
  const [gmeResult, punResult, fallbackResult] = await Promise.allSettled([
    login && password ? fetchFromGme(login, password, now) : Promise.reject(new Error('no credentials')),
    fetchPunFromEnergyCharts(now),
    fetchEnergyPricesFallback(now),
  ]);

  // 4) Combina i risultati
  let base: GmeEnergyData;

  if (gmeResult.status === 'fulfilled') {
    base = gmeResult.value;
    console.log('getPunPsv: PSV da GME');
  } else {
    console.warn('getPunPsv: GME fallito:', (gmeResult as PromiseRejectedResult).reason?.message ?? gmeResult.reason);
    if (fallbackResult.status === 'fulfilled') {
      base = fallbackResult.value;
      console.log('getPunPsv: PSV da energy-prices fallback');
    } else if (cached) {
      console.log('getPunPsv: uso cache scaduta');
      return new Response(JSON.stringify(cached), { status: 200, headers: HEADERS });
    } else {
      return new Response(JSON.stringify({ error: 'Dati energia non disponibili' }), { status: 503, headers: HEADERS });
    }
  }

  // 5) Sovrapponi PUN da energy-charts (sempre preferito)
  if (punResult.status === 'fulfilled') {
    const pun = punResult.value;
    console.log(`getPunPsv: PUN energy-charts — ${pun.punMonthly?.length ?? 0} mesi, ${pun.punHourly?.length ?? 0} ore`);
    if (pun.punMonthly && pun.punMonthly.length > 0) {
      base.punMonthly = pun.punMonthly;
      base.pun = {
        avg: pun.punLatest.avg, min: pun.punLatest.min, max: pun.punLatest.max,
        prevAvg: pun.punMonthly.length >= 2 ? pun.punMonthly[pun.punMonthly.length - 2].avg : 0,
        live: false,
      };
    }
    if (pun.punHourly && pun.punHourly.length > 0) {
      base.punHourly = pun.punHourly;
    }
  } else {
    console.warn('getPunPsv: PUN energy-charts fallito:', (punResult as PromiseRejectedResult).reason?.message ?? punResult.reason);
  }

  base.cachedAt = now.toISOString();
  await writeCache(base);
  return new Response(JSON.stringify(base), { status: 200, headers: HEADERS });
};

export const config = { path: '/api/public/pun-psv' };
