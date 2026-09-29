const https = require('https');
const querystring = require('querystring');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function parseBody(event) {
  const ct = (event.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    try { return JSON.parse(event.body || '{}'); } catch (e) { return {}; }
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    return querystring.parse(event.body || '');
  }
  // Try JSON anyway
  try { return JSON.parse(event.body || '{}'); } catch (e) {}
  return querystring.parse(event.body || '');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const body = parseBody(event);

  const telefono = body.Telefono || body.telefono || '';
  const nome = body.Nome || body.nome || '';
  const cognome = body.Cognome || body.cognome || '';
  const email = body.Email || body.email || '';
  const ip = body.IP || body.IP_remoto || body.ip || '0.0.0.0';

  if (!telefono) {
    // Return 200 so Elementor doesn't show error
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, error: 'Telefono mancante' }) };
  }

  // Normalize phone to 0039XXXXXXXXXX
  let tel = telefono.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (tel.startsWith('+39')) tel = '00' + tel.slice(1);
  else if (tel.startsWith('39') && tel.length > 10) tel = '00' + tel;
  else if (!tel.startsWith('00')) tel = '0039' + tel;

  const payload = JSON.stringify({
    telefono: tel,
    ip,
    urlPrivacy: 'https://energiautomatica.it/supermoney/',
    tipoCliente: '6made4_lead',
    skipDeduplica: true,
    nome,
    cognome,
    email,
    consensi: {
      informativaPrivacy: { consenso: true },
      condizioniGenerali: { consenso: true },
      comunicazioniPreventivi: { consenso: true },
    },
  });

  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.supermoney.it',
          path: '/service/leads/contatti/energia',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            username: '6MADE4',
            secret: 'CiJ4b5WfGa86izx77XnVqWT7brnoC7L2',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    // Always return 200 so Elementor doesn't show webhook error
    return { statusCode: 200, headers: CORS, body: result.body };
  } catch (err) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
