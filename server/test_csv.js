const http = require('http');

function makeRequest(path, method, data, cookie) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data ? JSON.stringify(data).length : 0
            }
        };

        if (cookie) opts.headers['Cookie'] = cookie;

        const req = http.request(opts, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function testCSV() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await makeRequest('/api/admin/login', 'POST', { username: 'admin', password: 'admin123' });
        const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

        // 2. Export CSV
        console.log('Exporting CSV...');
        const csvRes = await makeRequest('/api/records/export', 'GET', null, cookie);

        console.log('Status:', csvRes.statusCode);
        console.log('Content-Type:', csvRes.headers['content-type']);
        console.log('Body Preview:', csvRes.body.substring(0, 200));

    } catch (err) {
        console.error('Test failed:', err);
    }
}

testCSV();
