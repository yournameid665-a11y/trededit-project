const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors());

// Serve static frontend files if placed in the same project directory
app.use(express.static(__dirname));

const VIDU_API_KEY = process.env.VIDU_API_KEY;

if (!VIDU_API_KEY) {
    console.error("FATAL ERROR: Environment variable VIDU_API_KEY is missing!");
}

// 1. Initiate Video Generation Task
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, aspect_ratio, duration, resolution } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required." });
        }

        const payload = {
            model: "viduq3-turbo",
            prompt: prompt,
            duration: parseInt(duration) || 5,
            aspect_ratio: aspect_ratio || "9:16",
            resolution: resolution || "720p"
        };

        const viduResponse = await fetch('https://api.vidu.com/ent/v2/text2video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${VIDU_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await viduResponse.json();

        if (!viduResponse.ok) {
            return res.status(viduResponse.status).json({ 
                error: data.message || data.error || "Failed to create Vidu task" 
            });
        }

        // Returns task_id and initial state
        res.json({
            task_id: data.task_id,
            state: data.state || "created"
        });

    } catch (err) {
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

// 2. Poll Task Status and Fetch Result
app.get('/api/status/:taskId', async (req, res) => {
    try {
        const taskId = req.params.taskId;

        const viduResponse = await fetch(`https://api.vidu.com/ent/v2/tasks/${taskId}/creations`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${VIDU_API_KEY}`
            }
        });

        const data = await viduResponse.json();

        if (!viduResponse.ok) {
            return res.status(viduResponse.status).json({ 
                error: data.message || "Failed to poll task status" 
            });
        }

        /* 
          Vidu Task State Response structure:
          state: "created" | "queueing" | "processing" | "success" | "failed"
        */
        let videoUrl = null;
        if (data.state === 'success' && data.creations && data.creations.length > 0) {
            videoUrl = data.creations[0].url || data.creations[0];
        }

        res.json({
            state: data.state,
            video_url: videoUrl,
            error_message: data.error_message || null
        });

    } catch (err) {
        res.status(500).json({ error: "Status check failed: " + err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
