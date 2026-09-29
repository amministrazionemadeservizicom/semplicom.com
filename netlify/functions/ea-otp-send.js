const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function makeToken(email, otp) {
  const secret = process.env.OTP_SECRET || 'ea-otp-secret-semplicom-2026';
  const window = Math.floor(Date.now() / 600000); // 10 min window
  return crypto.createHmac('sha256', secret).update(`${email}:${otp}:${window}`).digest('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }

  const email = (body.email || '').trim();
  const nome = (body.nome || '').trim();

  if (!email) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Email obbligatoria' }) };

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const token = makeToken(email, otp);

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    await sgMail.send({
      to: email,
      from: 'noreply@semplicom.com',
      subject: 'Il tuo codice di verifica — SempliCom',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <img src="https://semplicom.com/assets/img/logo.svg" alt="SempliCom" style="height:40px;margin-bottom:24px;">
          <h2 style="color:#333;margin-bottom:8px;">Ciao${nome ? ' ' + nome : ''}!</h2>
          <p style="color:#555;margin-bottom:24px;">Ecco il tuo codice di verifica:</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:2.5rem;font-weight:700;letter-spacing:8px;color:#7b2d8b;">${otp}</span>
          </div>
          <p style="color:#888;font-size:0.85rem;">Il codice è valido per 10 minuti.</p>
        </div>
      `,
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, token }) };
  } catch (err) {
    console.error('SendGrid error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Errore invio email' }) };
  }
};
