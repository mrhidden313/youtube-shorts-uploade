/**
 * Farman Bulk Uploader - Server
 * Self-hosted version with user-provided credentials
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Services
const configService = require('./services/configService');

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

// Main route - redirect based on setup status
app.get('/', (req, res) => {
    if (configService.isSetupComplete()) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.redirect('/setup');
    }
});

// Setup page
app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', async () => {
    console.log('========================================');
    console.log('  FARMAN BULK UPLOADER v2.0');
    console.log('========================================');
    console.log(`Server: http://localhost:${PORT}`);

    if (configService.isSetupComplete()) {
        console.log('Status: ✅ Setup complete');
        console.log('Starting scheduler...');

        // Initialize scheduler
        try {
            const schedulerService = require('./services/schedulerService');
            await schedulerService.initScheduler();
        } catch (err) {
            console.error('Scheduler error:', err.message);
        }
    } else {
        console.log('Status: ⚠️ Setup required');
        console.log(`Open http://localhost:${PORT}/setup to configure`);
    }

    console.log('========================================');
});
