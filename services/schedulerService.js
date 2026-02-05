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
    const now = Date.now();
    if (cachedTime && (now - lastFetchTime) < CACHE_SECONDS * 1000) {
        return cachedTime.plus({ seconds: Math.floor((now - lastFetchTime) / 1000) });
    }
    try {
        cachedTime = await fetchRealTime(timezone);
        lastFetchTime = now;
        return cachedTime;
    } catch (error) {
        console.error('[Time API] Fallback to luxon');
        return DateTime.now().setZone(timezone);
    }
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

const checkAndUpload = async () => {
    try {
        const videos = storageService.getVideos();
        const pending = videos.filter(v => v.status === 'pending');

        if (pending.length === 0) return;

        for (const video of pending) {
            if (await isReadyForUpload(video)) {
                const locked = storageService.lockVideoForUpload(video.id);
                if (!locked) return;

                console.log(`[UPLOAD] ${locked.title}`);

                let retries = 0;
                let success = false;

                while (retries <= MAX_RETRIES && !success) {
                    try {
                        await youtubeService.uploadVideo(locked, {
                            title: locked.title,
                            description: locked.description,
                            tags: locked.tags,
                            videoType: locked.videoType
                        });
                        storageService.updateVideoStatus(locked.id, 'uploaded');
                        console.log(`[UPLOAD] SUCCESS!`);
                        success = true;
                    } catch (err) {
                        retries++;
                        console.error(`[UPLOAD] Attempt ${retries} failed:`, err.message);
                        if (retries > MAX_RETRIES) {
                            storageService.updateVideoStatus(locked.id, 'failed', err.message);
                        } else {
                            console.log(`[UPLOAD] Retrying...`);
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    }
                }
                return;
            }
        }
    } catch (err) {
        console.error("[Scheduler] Error:", err);
    }
};

const initScheduler = async () => {
    console.log('========================================');
    console.log('  FARMAN BULK UPLOADER v2.0');
    console.log('========================================');

    try {
        const pk = await fetchRealTime('Asia/Karachi');
        console.log(`Pakistan Time: ${pk.toFormat('yyyy-MM-dd hh:mm:ss a')}`);
    } catch (e) {
        console.log('Could not fetch real time');
    }

    console.log(`Window: ${UPLOAD_WINDOW_MINUTES}min | Retries: ${MAX_RETRIES}`);
    console.log('========================================');

    if (scheduledTask) scheduledTask.stop();
    scheduledTask = cron.schedule('* * * * *', checkAndUpload);
    scheduledTask.start();
};

module.exports = { initScheduler, updateSchedule: initScheduler };
