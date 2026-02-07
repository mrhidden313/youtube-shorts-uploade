const API = '/api';

async function loadVideos() {
    const res = await fetch(`${API}/status`);
    const videos = await res.json();

    // Separate by status
    const pending = videos.filter(v => v.status === 'pending' || v.status === 'processing');
    const uploaded = videos.filter(v => v.status === 'uploaded');
    const failed = videos.filter(v => v.status === 'failed');

    // Sort by date (newest first for uploaded/failed, soonest first for pending)
    const sortBySchedule = (a, b) => new Date(a.scheduledDateTime) - new Date(b.scheduledDateTime);
    const sortByDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);

    pending.sort(sortBySchedule);
    uploaded.sort(sortByDate);
    failed.sort(sortByDate);

    // Update counts
    document.getElementById('pendingCount').textContent = pending.length;
    document.getElementById('uploadedCount').textContent = uploaded.length;
    document.getElementById('failedCount').textContent = failed.length;

    // Render lists
    renderList('pendingList', pending, 'pending');
    renderList('uploadedList', uploaded, 'uploaded');
    renderList('failedList', failed, 'failed');
}



// Calculate countdown - shows hours and minutes until upload
function getCountdown(scheduleDate) {
    const now = new Date();
    const diff = scheduleDate.getTime() - now.getTime();

    if (diff <= 0) {
        return '<div class="countdown-badge now">⏰ Uploading now...</div>';
    }

    const totalMinutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let text = '';
    if (hours > 0) {
        text = `${hours}h ${minutes}m`;
    } else {
        text = `${minutes}m`;
    }

    // Add class based on time remaining
    let badgeClass = 'countdown-badge';
    if (totalMinutes <= 30) {
        badgeClass += ' soon';
    }

    return `<div class="${badgeClass}">⏳ Uploads in ${text}</div>`;
}

async function cancelVideo(id) {
    if (!confirm('Cancel this upload? Video will be removed from queue.')) return;
    await deleteVideoAPI(id);
}

async function deleteVideo(id) {
    if (!confirm('Delete this video from local storage?')) return;
    await deleteVideoAPI(id);
}

async function deleteVideoAPI(id) {
    try {
        const res = await fetch(`${API}/video/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            loadVideos();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Failed to delete video');
    }
}

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "Adding...";

    // Calculate scheduled time
    const uploadHours = parseInt(document.getElementById('uploadHours').value) || 0;
    const uploadMinutes = parseInt(document.getElementById('uploadMinutes').value) || 0;

    const now = new Date();
    // Calculate total milliseconds to add
    const offsetMs = (uploadHours * 60 * 60 * 1000) + (uploadMinutes * 60 * 1000);
    const scheduledTime = new Date(now.getTime() + offsetMs);

    console.log("Current Time:", now.toISOString());
    console.log("Planned Upload Time:", scheduledTime.toISOString());
    console.log("Hours Offset:", uploadHours, "Minutes Offset:", uploadMinutes);

    const formData = new FormData();
    formData.append('video', document.getElementById('videoFile').files[0]);
    formData.append('title', document.getElementById('videoTitle').value);
    formData.append('description', document.getElementById('videoDesc').value);
    formData.append('tags', document.getElementById('videoTags').value);
    formData.append('videoType', document.getElementById('videoType').value);
    formData.append('scheduledDateTime', scheduledTime.toISOString());
    // Also send components just in case
    formData.append('uploadHours', uploadHours);
    formData.append('uploadMinutes', uploadMinutes);
    formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi');

    try {
        const res = await fetch(`${API}/upload`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            e.target.reset();
            document.getElementById('uploadHours').value = '0';
            document.getElementById('uploadMinutes').value = '30';
            loadVideos();
        } else {
            const err = await res.json();
            alert("Upload failed: " + (err.error || 'Unknown error'));
        }
    } catch (err) {
        console.error(err);
        alert("Error connecting to server");
    }

    btn.disabled = false;
    btn.innerText = "Add to Queue";
});

// Check Channel Status & Show Name/Avatar
async function checkChannelStatus() {
    const container = document.getElementById('channelStatus');
    if (!container) return;

    try {
        const res = await fetch(`${API}/channel-status`);
        const data = await res.json();

        if (data.connected) {
            container.className = 'channel-status';
            container.innerHTML = `
                <img src="${data.avatar}" class="channel-avatar">
                <span class="channel-name">${data.name}</span>
                <span class="status-dot" style="color:var(--success); font-size: 20px;">●</span>
            `;
        } else {
            container.className = 'channel-status error';
            container.innerHTML = `⚠️ ${data.error || 'Connection Failed'}`;
        }
    } catch (err) {
        console.error('Status check failed:', err);
        container.className = 'channel-status error';
        container.innerHTML = `⚠️ Connection Error`;
    }
}

// ... existing renderList function ...

function renderList(containerId, videos, type) {
    const container = document.getElementById(containerId);

    if (videos.length === 0) {
        container.innerHTML = '<div class="empty-msg">No videos</div>';
        return;
    }

    container.innerHTML = videos.map(v => {
        const scheduleDate = v.scheduledDateTime ? new Date(v.scheduledDateTime) : null;
        const actionBtn = type === 'pending'
            ? `<button class="btn-cancel" onclick="cancelVideo('${v.id}')">Cancel</button>`
            : `<button class="btn-delete" onclick="deleteVideo('${v.id}')">Delete</button>`;

        // Calculate countdown for pending videos
        let countdownHtml = '';
        let statusBadge = '';

        if (type === 'pending') {
            statusBadge = `<div class="storage-badge" style="font-size: 11px; background: rgba(0, 255, 242, 0.1); padding: 4px 8px; border-radius: 4px; color: var(--aqua); border: 1px solid rgba(0, 255, 242, 0.2); display: inline-block; margin-bottom: 5px;">💾 Stored on Device</div>`;
            if (scheduleDate) {
                const countdown = getCountdown(scheduleDate);
                countdownHtml = countdown;
            }
        }

        return `
            <div class="video-card">
                <div class="video-info">
                    ${statusBadge}
                    <div class="video-title">
                        <span class="video-type ${v.videoType || 'short'}">${(v.videoType || 'short').toUpperCase()}</span>
                        ${v.title}
                    </div>
                    <div class="video-meta">${v.filename}</div>
                    ${countdownHtml}
                    ${v.error ? `<div class="error-msg">⚠️ ${v.error}</div>` : ''}
                </div>
                <!-- ... existing schedule ... -->
                <div class="video-schedule">
                    ${scheduleDate ? `
                        <div class="date">${scheduleDate.toLocaleDateString()}</div>
                        <div class="time">${scheduleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    ` : '<div class="date">Not scheduled</div>'}
                </div>
                <div class="video-actions">
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
}

// ... existing code ...

// Init - refresh every 30 seconds to update countdown timers
loadVideos();
checkChannelStatus(); // Call status check
setInterval(loadVideos, 30000);
