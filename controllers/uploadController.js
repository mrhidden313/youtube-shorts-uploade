const storageService = require('../services/storageService');
const path = require('path');

const uploadVideo = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const { title, description, tags, videoType, scheduledDateTime, timezone, uploadHours, uploadMinutes } = req.body;

        // Calculate and validate scheduled time
        let finalScheduledDateTime = scheduledDateTime;

        // Validation: verify it looks like a date string and is valid
        const isValidDate = (d) => {
            return d && !isNaN(Date.parse(d));
        };

        if (!isValidDate(finalScheduledDateTime)) {
            console.log('[Upload] Invalid or missing direct Date, calculating from offset...');
            const hours = parseInt(uploadHours) || 0;
            const minutes = parseInt(uploadMinutes) || 0;

            // Default to 15 mins if both are 0 or missing, just to be safe so it schedules something
            if (hours === 0 && minutes === 0) {
                const now = new Date();
                // Default 15 min buffer
                finalScheduledDateTime = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
            } else {
                const now = new Date();
                const offsetMs = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
                finalScheduledDateTime = new Date(now.getTime() + offsetMs).toISOString();
            }
        }

        console.log('[Upload] Scheduled DateTime:', finalScheduledDateTime);

        const videoEntry = {
            id: Date.now().toString(),
            filename: req.file.filename,
            path: req.file.path,
            title: title || req.file.originalname,
            description: description || '',
            tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
            videoType: videoType || 'short',
            scheduledDateTime: finalScheduledDateTime,
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
