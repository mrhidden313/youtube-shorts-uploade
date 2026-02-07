const fs = require('fs');
const path = require('path');

const USERS_DIR = path.join(__dirname, '../data/users');

// Ensure Users Directory exists
if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
}

const getUserDBPath = (userId) => path.join(USERS_DIR, `${userId}.json`);

const initUser = (userId) => {
    const dbPath = getUserDBPath(userId);
    if (!fs.existsSync(dbPath)) {
        // Initial DB State for new user
        const initialData = {
            settings: {
                isSetupComplete: false,
                clientId: null,
                clientSecret: null,
                redirectUri: null,
                accessToken: null,
                refreshToken: null,
                tokenExpiry: null
            },
            videos: []
        };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    }
};

const readUserDB = (userId) => {
    try {
        const dbPath = getUserDBPath(userId);
        if (!fs.existsSync(dbPath)) return { settings: {}, videos: [] };
        const data = fs.readFileSync(dbPath);
        return JSON.parse(data);
    } catch (error) {
        console.error(`DB Read Error (${userId}):`, error);
        return { settings: {}, videos: [] };
    }
};

const writeUserDB = (userId, data) => {
    const dbPath = getUserDBPath(userId);
    const tempPath = `${dbPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, dbPath);
};

// Get all user IDs (for scheduler)
const getAllUsers = () => {
    try {
        return fs.readdirSync(USERS_DIR)
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''));
    } catch (e) {
        return [];
    }
};

module.exports = {
    initUser,
    getAllUsers,

    getSettings: (userId) => readUserDB(userId).settings,

    updateSettings: (userId, newSettings) => {
        const db = readUserDB(userId);
        db.settings = { ...db.settings, ...newSettings };
        writeUserDB(userId, db);
        return db.settings;
    },

    getVideos: (userId) => readUserDB(userId).videos,

    addVideo: (userId, video) => {
        const db = readUserDB(userId);
        db.videos.push(video);
        writeUserDB(userId, db);
        return video;
    },

    updateVideoStatus: (userId, id, status, error = null) => {
        const db = readUserDB(userId);
        const videoIndex = db.videos.findIndex(v => v.id === id);
        if (videoIndex > -1) {
            db.videos[videoIndex].status = status;
            if (error) db.videos[videoIndex].error = error;
            writeUserDB(userId, db);
            return db.videos[videoIndex];
        }
        return null;
    },

    lockVideoForUpload: (userId, targetVideoId) => {
        const db = readUserDB(userId);
        const isProcessing = db.videos.some(v => v.status === 'processing');
        if (isProcessing) return null;

        const videoIndex = targetVideoId
            ? db.videos.findIndex(v => v.id === targetVideoId && v.status === 'pending')
            : db.videos.findIndex(v => v.status === 'pending');

        if (videoIndex > -1) {
            db.videos[videoIndex].status = 'processing';
            writeUserDB(userId, db);
            return db.videos[videoIndex];
        }
        return null;
    },

    clearVideosByStatus: (userId, status) => {
        const db = readUserDB(userId);
        const initialLength = db.videos.length;

        // Note: In multi-user, we might want to be careful about deleting files if paths are shared.
        // But assumed each upload has unique path or is temp.
        db.videos.filter(v => v.status === status).forEach(v => {
            try {
                if (v.path && fs.existsSync(v.path)) {
                    fs.unlinkSync(v.path);
                }
            } catch (err) {
                console.error('Error deleting file:', err.message);
            }
        });

        db.videos = db.videos.filter(v => v.status !== status);
        writeUserDB(userId, db);
        return initialLength - db.videos.length;
    },

    deleteVideoById: (userId, id) => {
        const db = readUserDB(userId);
        const videoIndex = db.videos.findIndex(v => v.id === id);

        if (videoIndex === -1) return false;

        const video = db.videos[videoIndex];

        // Delete file from disk
        try {
            if (video.path && fs.existsSync(video.path)) {
                fs.unlinkSync(video.path);
            }
        } catch (err) {
            console.error('Error deleting file:', err.message);
        }

        // Remove from DB
        db.videos.splice(videoIndex, 1);
        writeUserDB(userId, db);
        return true;
    },

    getReadyVideos: (userId) => {
        const db = readUserDB(userId);
        const now = new Date();

        return db.videos.filter(v => {
            if (v.status !== 'pending') return false;
            if (!v.scheduledDateTime) return false;

            const scheduledTime = new Date(v.scheduledDateTime);
            return now >= scheduledTime;
        });
    }
};
