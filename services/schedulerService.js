/**
 * TIMEZONE-AWARE SCHEDULER WITH RETRY
 */

const cron = require('node-cron');
const { DateTime } = require('luxon');
const https = require('https');
const storageService = require('./storageService');
const youtubeService = require('./youtubeService');

let scheduledTask = null;
let cachedTime = null;
let lastFetchTime = 0;

const CACHE_SECONDS = 30;
const UPLOAD_WINDOW_MINUTES = 5;
const MAX_RETRIES = 1;

/**
 * Fetch REAL time from timeapi.io
 */
const fetchRealTime = (timezone) => {
    return new Promise((resolve, reject) => {
        const url = `https://timeapi.io/api/Time/current/zone?timeZone=${encodeURIComponent(timezone)}`;

        https.get(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'FarmanBulkUploader/1.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const realTime = DateTime.fromObject({
                        year: json.year, month: json.month, day: json.day,
                        hour: json.hour, minute: json.minute, second: json.seconds
                    }, { zone: timezone });
                    console.log(`[Time API] ${timezone}: ${realTime.toFormat('yyyy-MM-dd HH:mm:ss')}`);
                    resolve(realTime);
                } catch (e) {
                    reject(new Error('Parse error'));
                }
            });
        }).on('error', reject);
    });
};

const getCurrentTime = async (timezone) => {
    // Primary: System Time (Server Time)
    // Most cloud servers (Replit, Heroku, etc.) have correct time.
    // We use Luxon to handle timezone conversion.
    const systemTime = DateTime.now().setZone(timezone);

    // Optional: Verify with external API occasionally (every 5 mins)
    // If it fails, we JUST log it and continue using systemTime.
    const now = Date.now();
    if (!cachedTime || (now - lastFetchTime) > 300 * 1000) { // 5 minutes
        fetchRealTime(timezone).then(realTime => {
            cachedTime = realTime;
            lastFetchTime = now;

            // Check drift
            const drift = Math.abs(systemTime.diff(realTime, 'seconds').seconds);
            if (drift > 60) {
                console.warn(`[Time Warning] System time drifted by ${drift.toFixed(1)}s from Real Time API`);
            }
        }).catch(err => {
            console.log(`[Time API] Check failed (using system time): ${err.message}`);
        });
    }

    return systemTime;
};

const isReadyForUpload = async (video) => {
    if (video.status !== 'pending') return false;
    if (!video.scheduledDateTime) return false;

    const timezone = video.timezone || 'Asia/Karachi';
    const now = await getCurrentTime(timezone);
    const scheduled = DateTime.fromISO(video.scheduledDateTime, { zone: timezone });

    if (!scheduled.isValid) return false;

    const diffMinutes = now.diff(scheduled, 'minutes').minutes;

    console.log(`[Check] ${video.title} | Now: ${now.toFormat('HH:mm')} | Sched: ${scheduled.toFormat('HH:mm')} | Diff: ${diffMinutes.toFixed(1)}m`);

    if (diffMinutes < 0) return false;
    if (diffMinutes > UPLOAD_WINDOW_MINUTES) {
        storageService.updateVideoStatus(video.id, 'failed', `Missed (${diffMinutes.toFixed(0)}m late)`);
        return false;
    }
    return true;
};

const checkAndUpload = async (userId) => {
    try {
        const videos = storageService.getVideos(userId);
        const pending = videos.filter(v => v.status === 'pending');

        if (pending.length === 0) return;

        for (const video of pending) {
            if (await isReadyForUpload(video)) {
                const locked = storageService.lockVideoForUpload(userId, video.id);
                if (!locked) return;

                console.log(`[UPLOAD] User: ${userId} | Video: ${locked.title}`);

                let retries = 0;
                let success = false;

                while (retries <= MAX_RETRIES && !success) {
                    try {
                        await youtubeService.uploadVideo(userId, locked, {
                            title: locked.title,
                            description: locked.description,
                            tags: locked.tags,
                            videoType: locked.videoType
                        });
                        storageService.updateVideoStatus(userId, locked.id, 'uploaded');
                        success = true;
                    } catch (err) {
                        retries++;
                        console.error(`[UPLOAD] Failed (${retries}/${MAX_RETRIES}):`, err.message);
                        if (retries > MAX_RETRIES) {
                            storageService.updateVideoStatus(userId, locked.id, 'failed', err.message);
                        } else {
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    }
                }
                return; // One upload per user per cycle
            }
        }
    } catch (err) {
        console.error(`[Scheduler] Error for user ${userId}:`, err.message);
    }
};

const runSchedulerCycle = async () => {
    const users = storageService.getAllUsers();
    // console.log(`[Scheduler] Checking ${users.length} users...`);

    for (const userId of users) {
        await checkAndUpload(userId);
    }
};

const initScheduler = async () => {
    console.log('========================================');
    console.log('  MULTI-USER SCHEDULER STARTED');
    console.log('========================================');

    const pk = DateTime.now().setZone('Asia/Karachi');
    console.log(`System Time (PKT): ${pk.toFormat('yyyy-MM-dd hh:mm:ss a')}`);

    // Background check
    fetchRealTime('Asia/Karachi').catch(() => { });

    if (scheduledTask) scheduledTask.stop();
    scheduledTask = cron.schedule('* * * * *', runSchedulerCycle);
    scheduledTask.start();
};

module.exports = { initScheduler };
