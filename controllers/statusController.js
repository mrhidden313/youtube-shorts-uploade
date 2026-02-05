const storageService = require('../services/storageService');

const getStatus = (req, res) => {
    const videos = storageService.getVideos();
    res.json(videos);
};

const getSettings = (req, res) => {
    const settings = storageService.getSettings();
    res.json(settings);
};

const updateSettings = (req, res) => {
    const { scheduleTime } = req.body;
    if (scheduleTime) {
        storageService.updateSettings({ scheduleTime });
    }
    res.json(storageService.getSettings());
};

const clearQueue = (req, res) => {
    const { status } = req.params;

    if (!['pending', 'failed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Use "pending" or "failed".' });
    }

    const count = storageService.clearVideosByStatus(status);
    res.json({ message: `Cleared ${count} ${status} videos.` });
};

const deleteVideo = (req, res) => {
    const { id } = req.params;

    const result = storageService.deleteVideoById(id);

    if (result) {
        res.json({ message: 'Video deleted successfully.' });
    } else {
        res.status(404).json({ error: 'Video not found.' });
    }
};

module.exports = {
    getStatus,
    getSettings,
    updateSettings,
    clearQueue,
    deleteVideo
};
