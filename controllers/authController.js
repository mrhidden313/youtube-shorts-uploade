/**
 * Auth Controller
 * Handles OAuth flow for user-provided credentials
 */

const { google } = require('googleapis');
const configService = require('../services/configService');

// OAuth scopes - ONLY youtube.upload needed
const SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload'
];

/**
 * Start OAuth flow
 */
const startAuth = (req, res) => {
    try {
        const { clientId, clientSecret, redirectUri } = req.body;

        if (!clientId || !clientSecret) {
            return res.status(400).json({ error: 'Client ID and Secret are required' });
        }

        configService.saveCredentials(clientId, clientSecret, redirectUri);

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'
        });

        res.json({ authUrl });
    } catch (error) {
        console.error('[Auth] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * OAuth callback
 */
const handleCallback = async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).send('No authorization code received');
        }

        const { clientId, clientSecret, redirectUri } = configService.getCredentials();

        if (!clientId || !clientSecret) {
            return res.status(400).send('Credentials not found');
        }

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
            return res.status(400).send('No refresh token. Revoke access and try again.');
        }

        configService.saveTokens(
            tokens.access_token,
            tokens.refresh_token,
            tokens.expiry_date
        );

        res.redirect('/');
    } catch (error) {
        console.error('[Auth] Callback error:', error);
        res.status(500).send(`Authentication failed: ${error.message}`);
    }
};

const checkSetup = (req, res) => {
    res.json({ isSetupComplete: configService.isSetupComplete() });
};

const resetSetup = (req, res) => {
    configService.resetConfig();
    res.json({ message: 'Configuration reset' });
};

module.exports = { startAuth, handleCallback, checkSetup, resetSetup };
