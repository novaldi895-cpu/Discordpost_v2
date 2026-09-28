const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path'); // Tambahan untuk mengatur path file

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// INI KUNCI UTAMANYA: Mengizinkan Express menampilkan file index.html
app.use(express.static(__dirname));

// Route utama untuk menampilkan index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API ENDPOINTS ---
// Database sementara
let configs = []; 

// Endpoint untuk membuat config baru
app.post('/api/config', (req, res) => {
    const { name, token, channelId, delay } = req.body;
    const newConfig = { id: Date.now(), name, token, channelId, delay, status: 'STOPPED' };
    configs.push(newConfig);
    res.json({ success: true, config: newConfig });
});

// Endpoint untuk memulai autopost
app.post('/api/start/:id', async (req, res) => {
    const config = configs.find(c => c.id == req.params.id);
    if (!config) return res.status(404).json({ error: 'Config not found' });

    config.status = 'RUNNING';
    
    const sendDiscordMessage = async () => {
        if (config.status !== 'RUNNING') return;
        try {
            const messageContent = "Ini pesan autopost dari bot!"; 
            await axios.post(`https://discord.com/api/v9/channels/${config.channelId}/messages`, 
                { content: messageContent },
                { headers: { 'Authorization': config.token } }
            );
            console.log(`[SUCCESS] Pesan terkirim ke ${config.channelId}`);
        } catch (error) {
            console.error(`[FAILED] Gagal mengirim:`, error.response?.data || error.message);
        }
    };

    setInterval(sendDiscordMessage, config.delay * 1000);
    res.json({ success: true, message: 'Autopost started' });
});

// --- PORT RAILWAY ---
// Railway memberikan Port secara otomatis lewat environment variable.
// Jangan hardcode ke 3000, gunakan process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend berjalan di port ${PORT}`));
