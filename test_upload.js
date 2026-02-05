const fs = require('fs');
const http = require('http');
const path = require('path');

const fileBuffer = fs.readFileSync('sample.mp4');
const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

const postDataStart = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="title"',
    '',
    'Test Node Upload',
    `--${boundary}`,
    'Content-Disposition: form-data; name="description"',
    '',
    'Uploaded via Node script',
    `--${boundary}`,
    'Content-Disposition: form-data; name="video"; filename="sample.mp4"',
    'Content-Type: video/mp4',
    '',
    ''
].join('\r\n');

const postDataEnd = `\r\n--${boundary}--`;

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(postDataStart) + fileBuffer.length + Buffer.byteLength(postDataEnd)
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(postDataStart);
req.write(fileBuffer);
req.write(postDataEnd);
req.end();
