const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

// Ensure DB exists
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ settings: {}, videos: [] }, null, 2));
}

const readDB = () => {
    try {
        const data = fs.readFileSync(DB_PATH);
        return JSON.parse(data);
    } catch (error) {
        console.error("DB Read Error:", error);
        return { settings: {}, videos: [] };
    }
};

const writeDB = (data) => {
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, DB_PATH);
};

module.exports = {
    getSettings: () => readDB().settings,

    updateSettings: (newSettings) => {
        const db = readDB();
        db.settings = { ...db.settings, ...newSettings };
        writeDB(db);
        return db.settings;
    },

    getVideos: () => readDB().videos,

    addVideo: (video) => {
        const db = readDB();
        db.videos.push(video);
        writeDB(db);
        return video;
    },

    updateVideoStatus: (id, status, error = null) => {
        const db = readDB();
        const videoIndex = db.videos.findIndex(v => v.id === id);
        if (videoIndex > -1) {
            db.videos[videoIndex].status = status;
            if (error) db.videos[videoIndex].error = error;
            writeDB(db);
            return db.videos[videoIndex];
        }
        return null;
    },

    lockVideoForUpload: (targetVideoId) => {
        const db = readDB();
        const isProcessing = db.videos.some(v => v.status === 'processing');
        if (isProcessing) return null;

        const videoIndex = targetVideoId
            ? db.videos.findIndex(v => v.id === targetVideoId && v.status === 'pending')
            : db.videos.findIndex(v => v.status === 'pending');

        if (videoIndex > -1) {
            db.videos[videoIndex].status = 'processing';
            writeDB(db);
            return db.videos[videoIndex];
        }
        return null;
    },

    clearVideosByStatus: (status) => {
        const db = readDB();
        const initialLength = db.videos.length;

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
        writeDB(db);
        return initialLength - db.videos.length;
    },

    deleteVideoById: (id) => {
        const db = readDB();
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
        writeDB(db);
        return true;
    },

    getReadyVideos: () => {
        const db = readDB();
        const now = new Date();

        return db.videos.filter(v => {
            if (v.status !== 'pending') return false;
            if (!v.scheduledDateTime) return false;

            const scheduledTime = new Date(v.scheduledDateTime);
            return now >= scheduledTime;
        });
    }
};
