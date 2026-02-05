const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const uploadController = require('../controllers/uploadController');
const statusController = require('../controllers/statusController');

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../data/uploads/'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Routes
router.post('/upload', upload.single('video'), uploadController.uploadVideo);
router.get('/status', statusController.getStatus);
router.get('/settings', statusController.getSettings);
router.post('/settings', statusController.updateSettings);
router.delete('/clear/:status', statusController.clearQueue);
router.delete('/video/:id', statusController.deleteVideo);

module.exports = router;
