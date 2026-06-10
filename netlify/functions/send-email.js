const sgMail = require('@sendgrid/mail');
const https = require('https');
const admin = require('firebase-admin');

// Inizializza Firebase Admin (una sola volta)
if (!admin.apps.length) {
    try {
        const raw = process.env.FIREBASE_ADMIN_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT;
        if (raw) {
            const svc = JSON.parse(raw);
            admin.initializeApp({
                credential: admin.credential.cert(svc),
                projectId: svc.project_id,
            });
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
        console.error('❌ Firebase Admin init error:', e.message);
    }
}

function getFirestore() {
    try { return admin.firestore(); } catch (e) { return null; }
}

// Normalizza telefono in formato 0039XXXXXXXXXX richiesto da Supermoney
function normalizePhone(raw) {
    if (!raw) return null;
    const cleaned = raw.replace(/[\s\-\(\)\+]/g, '');
    const digits = cleaned.startsWith('39') && cleaned.length >= 12
        ? cleaned
        : cleaned.startsWith('0039')
        ? cleaned.slice(2)
        : '39' + cleaned.replace(/^0+/, '');
    return '00' + digits;
}

// Invia lead a Edison via API Supermoney — ritorna { status, body }
function sendEdisonLead({ name, phone, email, ip, urlPrivacy }) {
    return new Promise((resolve) => {
        const username = process.env.EDISON_USERNAME || '6MADE';
        const secret = process.env.EDISON_SECRET || 'yZAKIQmJOPAL86FHxWltJK3D6fJUXWgt';

        const telefono = normalizePhone(phone);
        if (!telefono) { resolve(); return; }

        const parts = (name || '').trim().split(/\s+/);
        const payload = {
            telefono,
            ip: ip || '0.0.0.0',
            urlPrivacy: urlPrivacy || 'https://semplicom.com/privacy.html',
            tipoCliente: '6made_lead',
            skipDeduplica: true,
            consensi: {
                informativaPrivacy: { consenso: true },
                condizioniGenerali: { consenso: true },
                comunicazioniPreventivi: { consenso: true },
            },
        };
        if (parts.length >= 2) { payload.nome = parts[0]; payload.cognome = parts.slice(1).join(' '); }
        else if (parts[0]) { payload.nome = parts[0]; }
        if (email) payload.email = email;

        const body = JSON.stringify(payload);
        const options = {
            hostname: 'api.supermoney.it',
            path: '/service/leads/contatti/energia',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'username': username,
                'secret': secret,
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                console.log(`📤 Edison lead: ${res.statusCode}`, data);
                resolve({ status: res.statusCode, body: data });
            });
        });
        req.on('error', (err) => {
            console.error('❌ Edison lead error:', err.message);
            resolve({ status: 0, body: err.message });
        });
        req.write(body);
        req.end();
    });
}

exports.handler = async (event) => {
    // Solo POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Configura SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    try {
        const data = JSON.parse(event.body);
        const { name, nome: nomeRaw, cognome: cognomeRaw, email, company, phone, plan, employees, message, privacy, subject: customSubject } = data;

        // Validazione base
        if (!name || !email || !privacy) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Campi obbligatori mancanti' })
            };
        }

        // Email a voi (notifica nuovo contatto)
        const msgToAdmin = {
            to: 'amministrazione@madeservizi.com',
            from: 'noreply@semplicom.com', // Deve essere verificato su SendGrid
            replyTo: email,
            subject: customSubject ? `${customSubject} - ${name}` : `Nuova richiesta demo - ${name}${company ? ` (${company})` : ''}`,
            html: `
                <h2>${customSubject ? `${customSubject} da semplicom.com` : 'Nuova richiesta demo da semplicom.com'}</h2>
                <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Nome:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
                    </tr>
                    ${company ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Azienda:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${company}</td>
                    </tr>
                    ` : ''}
                    ${phone ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Telefono:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="tel:${phone}">${phone}</a></td>
                    </tr>
                    ` : ''}
                    ${plan ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Piano interessato:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${plan}</td>
                    </tr>
                    ` : ''}
                    ${employees ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>N. dipendenti:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${employees}</td>
                    </tr>
                    ` : ''}
                    ${message ? `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Messaggio:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${message}</td>
                    </tr>
                    ` : ''}
                </table>
                <p style="margin-top: 20px; color: #666; font-size: 12px;">
                    Richiesta inviata da semplicom.com il ${new Date().toLocaleString('it-IT')}
                </p>
            `
        };

        await sgMail.send(msgToAdmin);

        // Se è il form offerte luce/gas → invia lead a Edison (Supermoney)
        let edisonResult = null;
        if (plan === 'Offerte Luce e Gas' && phone) {
            const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
                || event.headers['x-nf-client-connection-ip']
                || '0.0.0.0';
            edisonResult = await sendEdisonLead({
                name, phone, email,
                ip: clientIp,
                urlPrivacy: 'https://semplicom.com/migliori-offerte-luce-gas/',
            });
        }

        // Email di conferma al cliente
        let msgToClient;

        if (plan === 'Offerte Luce e Gas') {
            // Landing migliori-offerte-luce-gas — email consenso privacy + salvataggio Firestore
            const now = new Date();
            const refCode = `PRIV-${now.toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).toUpperCase().slice(2,8)}`;
            const dataFormattata = now.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const clientIpConsent = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
                || event.headers['x-nf-client-connection-ip']
                || '0.0.0.0';

            // Salva consenso via proxy sempliswitch (ha le credenziali Firebase)
            const nomeSalvato = nomeRaw || name.split(' ')[0] || '';
            const cognomeSalvato = cognomeRaw || name.split(' ').slice(1).join(' ') || '';
            const telefonoNorm = (phone || '').replace(/[\s\-\.]/g, '');
            fetch('https://semplicom.it/.netlify/functions/save-privacy-consent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    privacy_id: refCode,
                    nome: nomeSalvato,
                    cognome: cognomeSalvato,
                    email: email || '',
                    telefono: telefonoNorm,
                    data_consenso: now.toISOString(),
                    fonte: 'semplicom.com/migliori-offerte-luce-gas',
                    client_ip: clientIpConsent,
                }),
            }).then(r => console.log('✅ Privacy consent salvato:', r.status))
              .catch(err => console.error('❌ save-privacy-consent error:', err.message));

            msgToClient = {
                to: email,
                from: 'noreply@semplicom.com',
                subject: 'Grazie per la fiducia! ecco la conferma del tuo consenso',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <div style="text-align: center; padding: 24px 0 16px;">
                            <div style="display:inline-block; background:#f5f5f5; border-radius:8px; padding:12px 24px;">
                                <img src="https://semplicom.com/assets/img/logo.svg" alt="SempliCom" style="max-height: 60px; max-width: 220px;" />
                            </div>
                        </div>
                        <hr style="border:none; border-top:1px solid #e0e0e0; margin: 0 0 24px;" />
                        <div style="padding: 0 24px 24px;">
                            <p style="font-size:16px; font-weight:bold; margin-bottom:16px;">👋 Ciao ${name},</p>
                            <p style="margin-bottom:12px;">
                                ti scriviamo per confermarti che il tuo consenso al trattamento dei dati è stato correttamente
                                registrato tramite <span style="color:#D1009C; font-weight:600;">Semplicom</span>.
                            </p>
                            <p style="margin-bottom:24px;">
                                Questa conferma ci permette di assisterti nella gestione della tua richiesta e di fornirti supporto in modo chiaro e trasparente.
                            </p>
                            <p style="font-weight:600; margin-bottom:8px;">Riepilogo</p>
                            <p style="margin:0 0 4px;">• Codice di riferimento: <strong>${refCode}</strong></p>
                            <p style="margin:0 0 4px;">• IP: <strong>${clientIpConsent}</strong></p>
                            <p style="margin:0 0 24px;">• Data: <strong>${dataFormattata}</strong></p>
                            <p style="margin-bottom:8px;">Puoi consultare in qualsiasi momento:</p>
                            <p style="margin:0 0 4px;">• <a href="https://www.iubenda.com/privacy-policy/38620659" style="color:#D1009C;">Privacy Policy</a></p>
                            <p style="margin:0 0 24px;">• <a href="https://www.iubenda.com/termini-e-condizioni/38620659" style="color:#D1009C;">Termini e Condizioni</a></p>
                            <p style="margin-bottom:24px;">Se hai domande o desideri chiarimenti, puoi rispondere direttamente a questa email.</p>
                            <p style="margin-bottom:4px;">Grazie ancora per la fiducia,</p>
                            <p style="margin:0;">Il team <span style="color:#D1009C; font-weight:600;">Semplicom</span></p>
                        </div>
                        <div style="background:#f9f9f9; border-radius:8px; margin:0 24px 16px; padding:16px;">
                            <p style="font-weight:700; margin:0 0 8px;">Diritto di revoca</p>
                            <p style="margin:0 0 10px; font-size:14px; color:#555;">Ai sensi dell'art. 7 GDPR puoi revocare il tuo consenso in qualsiasi momento.</p>
                            <div style="background:#fffbe6; border:1px solid #f0c040; border-radius:6px; padding:10px; margin-bottom:10px;">
                                <p style="margin:0; font-size:13px; color:#7a5800;">⚠️ <strong>Attenzione:</strong> la revoca del consenso comporta l'impossibilità di procedere con la lavorazione del contratto. I trattamenti effettuati prima della revoca rimangono leciti.</p>
                            </div>
                            <p style="margin:0; font-size:13px; color:#555;">Se desideri revocare il consenso puoi farlo scrivendo a <a href="mailto:amministrazione@madeservizi.com" style="color:#D1009C;">amministrazione@madeservizi.com</a>.</p>
                        </div>
                        <div style="background:#fff3f0; border:1px solid #f5c0b0; border-radius:8px; margin:0 24px 24px; padding:16px;">
                            <p style="font-weight:700; color:#D1009C; margin:0 0 8px;">Consenso SuperMoney</p>
                            <p style="margin:0; font-size:13px; color:#555;">Hai anche prestato consenso a SuperMoney. Per revocarlo consulta la <a href="https://www.supermoney.it/privacy-policy/" style="color:#D1009C;">Privacy Policy SuperMoney</a>.</p>
                        </div>
                    </div>
                `
            };
        } else {
            // Tutti gli altri form — email generica invariata
            msgToClient = {
                to: email,
                from: 'noreply@semplicom.com',
                subject: 'Richiesta informazioni ricevuta – SempliCom',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="text-align: center; padding: 20px 0;">
                            <img src="https://semplicom.com/assets/img/logo.svg" alt="SempliCom" style="max-height: 80px;" />
                        </div>
                        <div style="padding: 20px;">
                            <p>Ciao ${name},</p>
                            <p>grazie per averci scritto.<br>
                            La tua richiesta è stata presa in carico: ti ricontatteremo entro 48 ore con tutti i dettagli.</p>
                            <p>A presto,<br><strong>Il team SempliCom</strong></p>
                        </div>
                    </div>
                `
            };
        }

        await sgMail.send(msgToClient);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: 'Email inviata con successo', edison: edisonResult })
        };

    } catch (error) {
        console.error('SendGrid Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Errore nell\'invio dell\'email' })
        };
    }
};
