const sgMail = require('@sendgrid/mail');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// Firebase Admin init
if (!admin.apps.length) {
    try {
        const raw = process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT;
        if (raw) {
            const svc = JSON.parse(raw);
            admin.initializeApp({ credential: admin.credential.cert(svc), projectId: svc.project_id });
        } else {
            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
            admin.initializeApp({
                credential: admin.credential.cert({ project_id: projectId, client_email: clientEmail, private_key: privateKey }),
                projectId,
            });
        }
    } catch (e) {
        console.error('Firebase Admin init error:', e.message);
    }
}

function getFirestore() {
    try { return admin.firestore(); } catch (e) { return null; }
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function row(label, value) {
    if (!value && value !== 0) return '';
    return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600;white-space:nowrap;vertical-align:top;width:200px;">${label}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${String(value).replace(/\n/g, '<br>')}</td>
    </tr>`;
}

function buildAdminHtml(d, nomeCompleto, cittaLabel, sourceLabel) {
    return `<div style="font-family:system-ui,sans-serif;max-width:700px;margin:0 auto;color:#212529;">
  <div style="background:#1A1A2E;padding:20px 28px;border-radius:8px 8px 0 0;">
    <img src="https://semplicom.com/assets/img/logo.svg" alt="SempliCom" style="height:36px;">
  </div>
  <div style="padding:24px 28px;background:#fff;border:1px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px;">
    <h2 style="margin:0 0 4px;font-size:18px;">Questionario compilato</h2>
    <p style="margin:0 0 20px;color:#6c757d;">Da: <strong>${sourceLabel}</strong> &mdash; ${new Date().toLocaleString('it-IT')}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tbody>
        <tr><td colspan="2" style="padding:8px 12px;background:#f8f9fa;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6c757d;">DATI DI CONTATTO</td></tr>
        ${row('Nome e cognome', nomeCompleto)}
        ${row('Ragione sociale', d.ragione_sociale)}
        ${row('P.IVA / Codice fiscale', d.piva_cf)}
        ${row('Città', cittaLabel)}
        ${row('Telefono', d.telefono)}
        ${row('Email', d.email)}
        <tr><td colspan="2" style="padding:8px 12px;background:#f8f9fa;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6c757d;">PROFILO</td></tr>
        ${row('Tipo di attività', d.tipo_attivita)}
        ${row('Anni nel settore', d.anni_settore)}
        ${row('N. collaboratori / agenti', d.n_collaboratori)}
        <tr><td colspan="2" style="padding:8px 12px;background:#f8f9fa;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6c757d;">SETTORI DI INTERESSE</td></tr>
        ${row('Settori', [d.settore_luce_gas && 'Luce e Gas', d.settore_telefonia && 'Telefonia fissa e mobile', d.settore_altro && 'Altro'].filter(Boolean).join(', ') || '—')}
        <tr><td colspan="2" style="padding:8px 12px;background:#f8f9fa;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6c757d;">SITUAZIONE ATTUALE</td></tr>
        ${row('Ha mandati / agenzie attive', d.ha_mandati)}
        ${row('Quali mandati / agenzie', d.quali_mandati)}
        ${row('Volume mensile contratti', d.volume_mensile)}
        <tr><td colspan="2" style="padding:8px 12px;background:#f8f9fa;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6c757d;">PIANO E NOTE</td></tr>
        ${row('Piano di interesse', d.piano)}
        ${row('Note', d.note)}
      </tbody>
    </table>
  </div>
</div>`;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    try {
        const data = JSON.parse(event.body);
        const { token, ...formData } = data;

        // Verifica token
        const secret = process.env.QUESTIONNAIRE_SECRET;
        if (!secret) {
            return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Configurazione mancante' }) };
        }

        let tokenData;
        try {
            tokenData = jwt.verify(token, secret);
        } catch (e) {
            return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Link non valido o scaduto. Richiedi un nuovo link.' }) };
        }

        const { requestId, source } = tokenData;

        // Validazione campi obbligatori
        const required = ['nome', 'cognome', 'ragione_sociale', 'piva_cf', 'citta', 'telefono', 'email', 'privacy'];
        for (const field of required) {
            if (!formData[field]) {
                return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `Campo obbligatorio mancante: ${field}` }) };
            }
        }

        const now = new Date();
        const submissionId = `QST-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).toUpperCase().slice(2, 8)}`;
        const nomeCompleto = `${formData.nome || ''} ${formData.cognome || ''}`.trim();
        const cittaLabel = `${formData.citta || ''}${formData.provincia ? ` (${formData.provincia})` : ''}`;
        const sourceLabel = source === 'diventa-partner' ? 'Diventa Partner' : 'Richiedi Demo';

        // Salva su Firestore
        const db = getFirestore();
        if (db) {
            try {
                await db.collection('questionnaire_submissions').doc(submissionId).set({
                    submissionId,
                    requestId,
                    source,
                    ...formData,
                    nome_completo: nomeCompleto,
                    submitted_at: now.toISOString(),
                });
                // Aggiorna demo_request
                try {
                    await db.collection('demo_requests').doc(requestId).update({
                        questionnaire_submitted_at: now.toISOString(),
                        submissionId,
                    });
                } catch (_) { /* requestId potrebbe non esistere se il token è stato generato diversamente */ }
            } catch (e) {
                console.error('Firestore questionnaire save error:', e.message);
            }
        }

        // Mail interna
        await sgMail.send({
            to: 'amministrazione@madeservizi.com',
            from: 'noreply@semplicom.com',
            replyTo: formData.email,
            subject: `Questionario compilato - ${nomeCompleto} (${cittaLabel}) - da ${sourceLabel}`,
            html: buildAdminHtml(formData, nomeCompleto, cittaLabel, sourceLabel),
        });

        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };

    } catch (error) {
        console.error('submit-questionnaire error:', error);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Errore interno del server' }) };
    }
};
