const API = 'http://localhost:3000/api';

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

        return `
            <div class="video-card">
                <div class="video-info">
                    <div class="video-title">
                        <span class="video-type ${v.videoType || 'short'}">${(v.videoType || 'short').toUpperCase()}</span>
                        ${v.title}
                    </div>
                    <div class="video-meta">${v.filename}</div>
                    ${v.error ? `<div class="error-msg">⚠️ ${v.error}</div>` : ''}
                </div>
                <div class="video-schedule">
                    ${scheduleDate ? `
                        <div class="date">${scheduleDate.toLocaleDateString()}</div>
                        <div class="time">${scheduleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${v.timezone || 'PKT'})</div>
                    ` : '<div class="date">Not scheduled</div>'}
                </div>
                <div class="video-actions">
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
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

    const formData = new FormData();
    formData.append('video', document.getElementById('videoFile').files[0]);
    formData.append('title', document.getElementById('videoTitle').value);
    formData.append('description', document.getElementById('videoDesc').value);
    formData.append('tags', document.getElementById('videoTags').value);
    formData.append('videoType', document.getElementById('videoType').value);
    formData.append('scheduleTime', document.getElementById('scheduleTime').value);
    formData.append('scheduleDate', document.getElementById('scheduleDate').value);
    formData.append('timezone', document.getElementById('timezone').value);

    try {
        const res = await fetch(`${API}/upload`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            e.target.reset();
            document.getElementById('scheduleDate').valueAsDate = new Date();
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

// Set default date
document.getElementById('scheduleDate').valueAsDate = new Date();

// Init
loadVideos();
setInterval(loadVideos, 5000);
