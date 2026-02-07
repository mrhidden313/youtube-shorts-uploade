/**
 * Farman Bulk Uploader - Server
 * Self-hosted version with user-provided credentials
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Session Middleware (Persistence for 1 Year)
app.use(session({
    genid: (req) => uuidv4(), // Use UUIDs for session IDs
    secret: 'farman-bulk-uploader-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 Year
        httpOnly: true
    }
}));

// User Context Middleware
app.use((req, res, next) => {
    if (!req.session.userId) {
        req.session.userId = uuidv4();
        console.log(`[New User] Assigned ID: ${req.session.userId}`);
    }
    // Make userId available to controllers
    req.userId = req.session.userId;
    next();
});

// Services
const configService = require('./services/configService');
const storageService = require('./services/storageService');

// Initialize User Data (Ensure DB exists for this user)
app.use((req, res, next) => {
    storageService.initUser(req.userId);
    next();
});

// Routes
const apiRoutes = require('./routes/api');
const authController = require('./controllers/authController');

// Auth routes
app.post('/auth/start', authController.startAuth);
app.get('/auth/callback', authController.handleCallback);
app.get('/auth/check', authController.checkSetup);
app.post('/auth/reset', authController.resetSetup);

// API routes
app.use('/api', apiRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Main & Setup Routes
app.get('/', (req, res) => {
    if (configService.isSetupComplete(req.userId)) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.redirect('/setup');
    }
});

app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
    console.log('========================================');
    console.log('  FARMAN BULK UPLOADER v3.0 (Multi-User)');
    console.log('========================================');
    console.log(`Server: http://localhost:${PORT}`);

    // Initialize scheduler
    try {
        const schedulerService = require('./services/schedulerService');
        await schedulerService.initScheduler();
    } catch (err) {
        console.error('Scheduler error:', err.message);
    }

    console.log('========================================');
});
