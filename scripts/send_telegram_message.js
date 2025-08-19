const https = require('https');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MESSAGE = process.env.MESSAGE;

if (!TOKEN ) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN.');
    process.exit(1);
}

if (!CHAT_ID) {
    console.error('❌ Missing TELEGRAM_CHAT_ID.');
    process.exit(1);
}

if (!MESSAGE) {
    console.error('❌ Missing MESSAGE.');
    process.exit(1);
}

const data = JSON.stringify({
    chat_id: CHAT_ID,
    text: MESSAGE,
});

const options = {
    hostname: 'api.telegram.org',
    path: `/bot${TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
    },
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log(`✅ Telegram response: ${body}`);
    });
});

req.on('error', (e) => {
    console.error(`❌ Problem with request: ${e.message}`);
});

req.write(data);
req.end();
