/**
 * YouTube Upload Service
 * Uses credentials from configService (user-provided)
 * NO hardcoded credentials
 */

const { google } = require('googleapis');
const fs = require('fs');
const configService = require('./configService');

let youtube = null;
let oauth2Client = null;

/**
 * Initialize OAuth client from user's saved credentials
 */
const initializeClient = async (userId) => {
    const { clientId, clientSecret, redirectUri } = configService.getCredentials(userId);
    const { refreshToken } = configService.getTokens(userId);

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Credentials not configured. Please run setup first.');
    }

    console.log(`[YouTube API] Initializing for User: ${userId}`);

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Refresh access token
    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);

        // Save new access token
        configService.updateAccessToken(userId, credentials.access_token, credentials.expiry_date);
    } catch (refreshError) {
        console.error(`[YouTube API] Token refresh failed for ${userId}:`, refreshError.message);
        throw new Error('Token refresh failed. Please re-authenticate.');
    }

    return google.youtube({ version: 'v3', auth: oauth2Client });
};

/**
 * Upload video to YouTube
 */
const uploadVideo = async (userId, video, metadata) => {
    const youtube = await initializeClient(userId);

    const isShort = metadata.videoType === 'short';

    console.log(`[YouTube API] Uploading: ${metadata.title} (User: ${userId})`);

    // Build hashtags
    let hashtags = '';
    if (metadata.tags && metadata.tags.length > 0) {
        hashtags = metadata.tags.map(t => `#${t.replace(/^#/, '').replace(/\s+/g, '')}`).join(' ');
    }

    // For Shorts: MUST include #shorts hashtag
    if (isShort && !hashtags.toLowerCase().includes('#shorts')) {
        hashtags = '#shorts ' + hashtags;
    }

    const fullDescription = `${metadata.description || ''}\n\n${hashtags}`.trim();

    // Add #Shorts to title for Shorts
    let finalTitle = metadata.title;
    if (isShort && !finalTitle.toLowerCase().includes('#shorts')) {
        if (finalTitle.length < 90) {
            finalTitle = `${finalTitle} #Shorts`;
        }
    }

    if (!fs.existsSync(video.path)) {
        throw new Error(`Video file not found: ${video.path}`);
    }

    const fileSize = fs.statSync(video.path).size;

    try {
        const response = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: finalTitle,
                    description: fullDescription,
                    categoryId: '22'
                },
                status: {
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(video.path)
            }
        });

        const videoId = response.data.id;
        const videoUrl = isShort
            ? `https://youtube.com/shorts/${videoId}`
            : `https://youtube.com/watch?v=${videoId}`;

        console.log(`[YouTube API] SUCCESS: ${videoUrl}`);
        return { videoId, url: videoUrl };

    } catch (error) {
        console.error(`[YouTube API] FAILED:`, error.message);
        if (error.code === 403) throw new Error('API quota exceeded or permission denied');
        if (error.code === 401) throw new Error('Authentication failed. Please re-authenticate.');
        throw error;
    }
};

/**
 * Get Channel Profile (Name & Avatar)
 */
const getChannelProfile = async (userId) => {
    try {
        const youtube = await initializeClient(userId);
        const response = await youtube.channels.list({
            part: 'snippet',
            mine: true
        });

        if (response.data.items && response.data.items.length > 0) {
            const channel = response.data.items[0];
            return {
                name: channel.snippet.title,
                avatar: channel.snippet.thumbnails.default.url,
                connected: true
            };
        }
        return { connected: false, error: 'No channel found' };
    } catch (error) {
        console.error(`[YouTube API] Profile fetch failed for ${userId}:`, error.message);
        if (error.message.includes('Credentials not configured')) {
            return { connected: false };
        }
        return { connected: false, error: error.message };
    }
};

module.exports = { uploadVideo, getChannelProfile };
