const sgMail = require('@sendgrid/mail');
const https = require('https');

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
            urlPrivacy: urlPrivacy || 'https://semplicom.com/migliori-offerte-luce-gas/',
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
        const { name, email, company, phone, plan, employees, message, privacy, subject: customSubject } = data;

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
                <h2>Nuova richiesta demo da semplicom.com</h2>
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

        // Email di conferma al cliente con template SendGrid
        const msgToClient = {
            to: email,
            from: 'noreply@semplicom.com',
            templateId: 'd-a87c4d5a42ce4ed89a59c62548d30cd5',
            dynamicTemplateData: {
                name: name,
                email: email,
                company: company || '',
                phone: phone || '',
                plan: plan || '',
                message: message || ''
            }
        };

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
