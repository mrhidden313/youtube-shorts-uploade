/**
 * Config Service (Multi-User)
 * Manages user configuration via Storage Service
 */

const storageService = require('./storageService');

module.exports = {
    isSetupComplete: (userId) => {
        const settings = storageService.getSettings(userId);
        return settings.isSetupComplete && settings.refreshToken;
    },

    getCredentials: (userId) => {
        const settings = storageService.getSettings(userId);
        return {
            clientId: settings.clientId,
            clientSecret: settings.clientSecret,
            redirectUri: settings.redirectUri
        };
    },

    getTokens: (userId) => {
        const settings = storageService.getSettings(userId);
        return {
            accessToken: settings.accessToken,
            refreshToken: settings.refreshToken,
            tokenExpiry: settings.tokenExpiry
        };
    },

    saveCredentials: (userId, clientId, clientSecret, redirectUri) => {
        storageService.updateSettings(userId, {
            clientId,
            clientSecret,
            redirectUri
        });
    },

    saveTokens: (userId, accessToken, refreshToken, expiryDate) => {
        storageService.updateSettings(userId, {
            accessToken,
            refreshToken,
            tokenExpiry: expiryDate,
            isSetupComplete: true
        });
    },

    updateAccessToken: (userId, accessToken, expiryDate) => {
        storageService.updateSettings(userId, {
            accessToken,
            tokenExpiry: expiryDate
        });
    },

    resetConfig: (userId) => {
        storageService.updateSettings(userId, {
            isSetupComplete: false,
            clientId: null,
            clientSecret: null,
            redirectUri: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null
        });
    }
};
