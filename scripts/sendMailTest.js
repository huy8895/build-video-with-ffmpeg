// sendMailTest.js
const nodemailer = require('nodemailer');

const CONFIG_JSON = process.env.CONFIG_JSON;

if (!CONFIG_JSON) {
    console.error('❌ CONFIG_JSON environment variable is missing.');
    process.exit(1);
}

let config;
try {
    config = JSON.parse(CONFIG_JSON);
} catch (error) {
    console.error('❌ Failed to parse CONFIG_JSON:', error.message);
    process.exit(1);
}

const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_TO,
    EMAIL_SUBJECT = 'Test Email from Node.js',
    EMAIL_TEXT = 'Hello! This is a test email from Node.js using nodemailer.'
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
