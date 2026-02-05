/**
 * Config Service
 * Manages user configuration (credentials, tokens)
 * NO hardcoded credentials - all user provided
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

const defaultConfig = {
    isSetupComplete: false,
    clientId: null,
    clientSecret: null,
    redirectUri: null,
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null
};

// Ensure config exists
const ensureConfig = () => {
    if (!fs.existsSync(CONFIG_PATH)) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    }
};

const readConfig = () => {
    ensureConfig();
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
        return { ...defaultConfig };
    }
};

const writeConfig = (config) => {
    const tempPath = `${CONFIG_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
    fs.renameSync(tempPath, CONFIG_PATH);
};

module.exports = {
    isSetupComplete: () => {
        const config = readConfig();
        return config.isSetupComplete && config.refreshToken;
    },

    getCredentials: () => {
        const config = readConfig();
        return {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            redirectUri: config.redirectUri
        };
    },

    getTokens: () => {
        const config = readConfig();
        return {
            accessToken: config.accessToken,
            refreshToken: config.refreshToken,
            tokenExpiry: config.tokenExpiry
        };
    },

    saveCredentials: (clientId, clientSecret, redirectUri) => {
        const config = readConfig();
        config.clientId = clientId;
        config.clientSecret = clientSecret;
        config.redirectUri = redirectUri;
        writeConfig(config);
    },

    saveTokens: (accessToken, refreshToken, expiryDate) => {
        const config = readConfig();
        config.accessToken = accessToken;
        config.refreshToken = refreshToken;
        config.tokenExpiry = expiryDate;
        config.isSetupComplete = true;
        writeConfig(config);
    },

    updateAccessToken: (accessToken, expiryDate) => {
        const config = readConfig();
        config.accessToken = accessToken;
        config.tokenExpiry = expiryDate;
        writeConfig(config);
    },

    resetConfig: () => {
        writeConfig({ ...defaultConfig });
    }
};
