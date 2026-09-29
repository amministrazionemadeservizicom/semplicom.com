const crypto = require('crypto');
const https = require('https');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function verifyToken(email, otp, token) {
  const secret = process.env.OTP_SECRET || 'ea-otp-secret-semplicom-2026';
  const window = Math.floor(Date.now() / 600000);
  // Check current and previous window (handles edge cases)
  for (const w of [window, window - 1]) {
    const expected = crypto.createHmac('sha256', secret).update(`${email}:${otp}:${w}`).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))) return true;
  }
  return false;
}

function normalizePhone(raw) {
  if (!raw) return null;
  let tel = raw.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (tel.startsWith('+39')) tel = '00' + tel.slice(1);
  else if (tel.startsWith('39') && tel.length > 10) tel = '00' + tel;
  else if (!tel.startsWith('00')) tel = '0039' + tel;
  return tel;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }

  const { email, otp, token, nome, cognome, telefono } = body;

  if (!email || !otp || !token) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Dati mancanti' }) };
  }

  if (!verifyToken(email.trim(), otp.trim(), token)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Codice non valido o scaduto' }) };
  }

  const tel = normalizePhone(telefono);
  if (!tel) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Telefono non valido' }) };
  }

  const payload = JSON.stringify({
    telefono: tel,
    ip: '0.0.0.0',
    urlPrivacy: 'https://semplicom.com/ea-otp/',
    tipoCliente: '6made4_lead',
    skipDeduplica: true,
    nome: nome || '',
    cognome: cognome || '',
    email: email.trim(),
    consensi: {
      informativaPrivacy: { consenso: true },
      condizioniGenerali: { consenso: true },
      comunicazioniPreventivi: { consenso: true },
    },
  });

  const result = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.supermoney.it',
      path: '/service/leads/contatti/energia',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        username: '6MADE4',
        secret: 'CiJ4b5WfGa86izx77XnVqWT7brnoC7L2',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  return { statusCode: 200, headers: CORS, body: result.body };
};
