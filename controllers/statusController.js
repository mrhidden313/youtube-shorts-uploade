const storageService = require('../services/storageService');

const getStatus = (req, res) => {
    const videos = storageService.getVideos(req.userId);
    res.json(videos);
};

const getSettings = (req, res) => {
    const settings = storageService.getSettings(req.userId);
    res.json(settings);
};

const updateSettings = (req, res) => {
    const { scheduleTime } = req.body;
    if (scheduleTime) {
        storageService.updateSettings(req.userId, { scheduleTime });
    }
    res.json(storageService.getSettings(req.userId));
};

const clearQueue = (req, res) => {
    const { status } = req.params;

    if (!['pending', 'failed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Use "pending" or "failed".' });
    }

    const count = storageService.clearVideosByStatus(req.userId, status);
    res.json({ message: `Cleared ${count} ${status} videos.` });
};

const deleteVideo = (req, res) => {
    const { id } = req.params;

    const result = storageService.deleteVideoById(req.userId, id);

    if (result) {
        res.json({ message: 'Video deleted successfully.' });
    } else {
        res.status(404).json({ error: 'Video not found.' });
    }
};

const getChannelStatus = async (req, res) => {
    try {
        const youtubeService = require('../services/youtubeService');
        const profile = await youtubeService.getChannelProfile(req.userId);
        res.json(profile);
    } catch (error) {
        res.status(500).json({
            connected: false,
            error: error.message
        });
    }
};

module.exports = {
    getStatus,
    getSettings,
    updateSettings,
    clearQueue,
    deleteVideo,
    getChannelStatus
};
