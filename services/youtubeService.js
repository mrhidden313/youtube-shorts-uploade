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
const initializeClient = async () => {
    const { clientId, clientSecret, redirectUri } = configService.getCredentials();
    const { refreshToken } = configService.getTokens();

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Credentials not configured. Please run setup first.');
    }

    console.log('[YouTube API] Initializing with user credentials...');

    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Refresh access token
    try {
        console.log('[YouTube API] Refreshing access token...');
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);

        // Save new access token
        configService.updateAccessToken(credentials.access_token, credentials.expiry_date);

        console.log('[YouTube API] Token refreshed successfully');
    } catch (refreshError) {
        console.error('[YouTube API] Token refresh failed:', refreshError.message);
        throw new Error('Token refresh failed. Please re-authenticate.');
    }

    youtube = google.youtube({ version: 'v3', auth: oauth2Client });
};

/**
 * Upload video to YouTube
 */
const uploadVideo = async (video, metadata) => {
    await initializeClient();

    const isShort = metadata.videoType === 'short';

    console.log(`[YouTube API] Uploading: ${metadata.title}`);
    console.log(`[YouTube API] Type: ${isShort ? 'SHORT' : 'LONG VIDEO'}`);

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
    console.log(`[YouTube API] Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

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
        }, {
            onUploadProgress: (evt) => {
                const progress = (evt.bytesRead / fileSize) * 100;
                process.stdout.write(`\r[YouTube API] Progress: ${progress.toFixed(1)}%`);
            }
        });

        const videoId = response.data.id;
        const videoUrl = isShort
            ? `https://youtube.com/shorts/${videoId}`
            : `https://youtube.com/watch?v=${videoId}`;

        console.log(`\n[YouTube API] SUCCESS!`);
        console.log(`[YouTube API] URL: ${videoUrl}`);

        return { videoId, url: videoUrl };

    } catch (error) {
        console.error(`\n[YouTube API] FAILED:`, error.message);

        if (error.code === 403) {
            throw new Error('API quota exceeded or permission denied');
        } else if (error.code === 401) {
            throw new Error('Authentication failed. Please re-authenticate.');
        }

        throw error;
    }
};

module.exports = { uploadVideo };
