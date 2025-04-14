// scripts/send_telegram_message.js

const https = require('https');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Missing required environment variables.');
    process.exit(1);
}

// Đọc MESSAGE từ stdin
let MESSAGE = '';
process.stdin.on('data', chunk => MESSAGE += chunk);
process.stdin.on('end', () => {
    if (!MESSAGE.trim()) {
        console.error('❌ Message is empty.');
        process.exit(1);
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const data = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: MESSAGE,
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
        },
    };

    const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log('✅ Message sent successfully!');
            } else {
                console.error(`❌ Failed to send message. Response: ${body}`);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Error sending message:', error);
    });

    req.write(data);
    req.end();
});
