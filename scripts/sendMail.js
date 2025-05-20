// sendMailTest.js
const nodemailer = require('nodemailer');

const CONFIG_EMAIL = process.env.CONFIG_EMAIL;
const EMAIL_TEXT = process.env.MESSAGE;
const EMAIL_TO = process.env.EMAIL_TO;

if (!CONFIG_EMAIL) {
    console.warn('❌ [Skipping] CONFIG_EMAIL environment variable is missing.');
    return; // hoặc process.exit(0) nếu bên ngoài function
}

if (!EMAIL_TO) {
    console.warn('ℹ️ [Skipping] email: EMAIL_TO is not set.');
    return;
}

let config;
try {
    config = JSON.parse(CONFIG_EMAIL);
} catch (error) {
    console.error('❌ Failed to parse CONFIG_JSON:', error.message);
    process.exit(1);
}

const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_SUBJECT = 'Build video notification',
} = config;

if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    console.error('❌ Missing one or more required email configuration fields.');
    process.exit(1);
}

async function sendTestEmail() {
    try {
        let transporter = nodemailer.createTransport({
            host: EMAIL_HOST,
            port: Number(EMAIL_PORT),
            secure: EMAIL_PORT == 465,
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS,
            },
        });

        let info = await transporter.sendMail({
            from: `"Node Mailer Test" <${EMAIL_USER}>`,
            to: EMAIL_TO,
            subject: EMAIL_SUBJECT,
            text: EMAIL_TEXT,
        });

        console.log('✅ Email sent successfully! Message ID:', info.messageId);
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
    }
}

sendTestEmail();
