const sgMail = require('@sendgrid/mail');

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
        const { name, email, company, phone, plan, employees, message, privacy } = data;

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
            subject: `Nuova richiesta demo - ${name}${company ? ` (${company})` : ''}`,
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
            body: JSON.stringify({ success: true, message: 'Email inviata con successo' })
        };

    } catch (error) {
        console.error('SendGrid Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Errore nell\'invio dell\'email' })
        };
    }
};
