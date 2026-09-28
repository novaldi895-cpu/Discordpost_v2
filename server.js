const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Database sementara (Gunakan MongoDB/MySQL untuk production)
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
    
    // Fungsi mengirim pesan ke Discord
    const sendDiscordMessage = async () => {
        if (config.status !== 'RUNNING') return;
        
        try {
            // Ganti dengan pesan yang ingin dikirim
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

    // Jalankan interval
    setInterval(sendDiscordMessage, config.delay * 1000);
    
    res.json({ success: true, message: 'Autopost started' });
});

app.listen(3000, () => console.log('Backend berjalan di port 3000'));
