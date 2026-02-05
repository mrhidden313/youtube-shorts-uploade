const storageService = require('../services/storageService');
const path = require('path');

const uploadVideo = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const { title, description, tags, videoType, scheduleTime, scheduleDate, timezone } = req.body;

        // Create scheduled datetime
        let scheduledDateTime = null;
        if (scheduleDate && scheduleTime) {
            scheduledDateTime = `${scheduleDate}T${scheduleTime}:00`;
        }

        const videoEntry = {
            id: Date.now().toString(),
            filename: req.file.filename,
            path: req.file.path,
            title: title || req.file.originalname,
            description: description || '',
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            videoType: videoType || 'short', // 'short' or 'long'
            scheduledDateTime: scheduledDateTime,
            timezone: timezone || 'Asia/Karachi',
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        storageService.addVideo(videoEntry);

        res.status(201).json({ message: 'Video added to queue', video: videoEntry });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload video' });
    }
};

module.exports = {
    uploadVideo
};
