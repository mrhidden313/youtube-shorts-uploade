/**
 * ONE-TIME SCRIPT: Run this once to get your Refresh Token
 * 
 * STEPS:
 * 1. Run: node get_refresh_token.js
 * 2. Browser will open, login with your YouTube channel's Google account
 * 3. Copy the code from the URL after authorization
 * 4. Paste the code in the terminal
 * 5. You'll get your REFRESH TOKEN - save it!
 */

const http = require('http');
const { URL } = require('url');
const open = require('open'); // You may need to install: npm install open
const readline = require('readline');

// Your Credentials (from Google Cloud Console)
const CLIENT_ID = '882622054673-jhd9k7cevaeof7g4knuiivq4122oqjke.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3333/oauth2callback';

// Scopes needed for YouTube upload
const SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
].join(' ');

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&access_type=offline` +
    `&prompt=consent`;

console.log('\n===========================================');
console.log('   YouTube OAuth Refresh Token Generator');
console.log('===========================================\n');

// Create a simple server to catch the callback
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:3333`);

    if (url.pathname === '/oauth2callback') {
        const code = url.searchParams.get('code');

        if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authorization Successful!</h1><p>You can close this window and check terminal.</p>');

            // Exchange code for tokens
            console.log('\n[✓] Authorization code received. Exchanging for tokens...\n');

            try {
                const tokens = await exchangeCodeForTokens(code);
                console.log('===========================================');
                console.log('   YOUR REFRESH TOKEN (SAVE THIS!)');
                console.log('===========================================\n');
                console.log(tokens.refresh_token);
                console.log('\n===========================================\n');
                console.log('Add this to your .env file as:');
                console.log('YOUTUBE_REFRESH_TOKEN=' + tokens.refresh_token);
                console.log('\n');
            } catch (error) {
                console.error('Error exchanging code:', error.message);
            }

            server.close();
            process.exit(0);
        } else {
            res.writeHead(400);
            res.end('No code found');
        }
    }
});

async function exchangeCodeForTokens(code) {
    const https = require('https');

    return new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
            code: code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        }).toString();

        const options = {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const tokens = JSON.parse(data);
                    if (tokens.error) {
                        reject(new Error(tokens.error_description || tokens.error));
                    } else {
                        resolve(tokens);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

server.listen(3333, async () => {
    console.log('[1] Opening browser for authorization...');
    console.log('[2] Login with your YouTube channel Google account');
    console.log('[3] Click "Allow" to grant permissions\n');

    // Try to open browser automatically
    try {
        const openModule = await import('open');
        await openModule.default(authUrl);
    } catch (e) {
        console.log('Could not auto-open browser. Please open this URL manually:\n');
        console.log(authUrl);
        console.log('\n');
    }
});
