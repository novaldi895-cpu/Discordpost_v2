const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- KONEKSI MONGODB ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI belum diisi di Railway Variables!");
}

// Tambahkan opsi bufferCommands: false agar error muncul langsung jika DB terputus
mongoose.connect(MONGODB_URI, { bufferCommands: false })
  .then(() => console.log('✅ Terhubung ke MongoDB'))
  .catch(err => console.error('❌ Gagal koneksi MongoDB:', err));

// --- SKEMA DATABASE ---
const TokenSchema = new mongoose.Schema({ token: String, username: String });
const ConfigSchema = new mongoose.Schema({
    name: String, 
    message: String,
    tokenId: String, 
    channel: String, 
    delay: Number,
    status: { type: String, default: 'STOPPED' }, 
    sentCount: { type: Number, default: 0 }
});
const Token = mongoose.model('Token', TokenSchema);
const Config = mongoose.model('Config', ConfigSchema);

// --- PENYIMPANAN INTERVAL ---
const activeIntervals = {};

// --- API ENDPOINTS (Dengan Try-Catch untuk Error Handling) ---

app.get('/api/tokens', async (req, res) => {
    try {
        const tokens = await Token.find();
        res.json(tokens);
    } catch (error) {
        console.error("Error GET /api/tokens:", error.message);
        res.status(500).json({ error: "Gagal mengambil data token dari database." });
    }
});

app.post('/api/tokens', async (req, res) => {
    try {
        const newToken = new Token({ token: req.body.token, username: `User_${Math.floor(Math.random()*1000)}` });
        await newToken.save();
        res.json({ success: true, token: newToken });
    } catch (error) {
        console.error("Error POST /api/tokens:", error.message);
        res.status(500).json({ error: "Gagal menyimpan token ke database." });
    }
});

app.delete('/api/tokens/:id', async (req, res) => {
    try {
        await Token.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error("Error DELETE /api/tokens:", error.message);
        res.status(500).json({ error: "Gagal menghapus token." });
    }
});

app.get('/api/configs', async (req, res) => {
    try {
        const configs = await Config.find();
        res.json(configs);
    } catch (error) {
        console.error("Error GET /api/configs:", error.message);
        res.status(500).json({ error: "Gagal mengambil data konfigurasi dari database." });
    }
});

app.post('/api/configs', async (req, res) => {
    try {
        const newConfig = new Config(req.body);
        await newConfig.save();
        res.json({ success: true, config: newConfig });
    } catch (error) {
        console.error("Error POST /api/configs:", error.message);
        res.status(500).json({ error: "Gagal menyimpan konfigurasi ke database." });
    }
});

app.delete('/api/configs/:id', async (req, res) => {
    try {
        if (activeIntervals[req.params.id]) { 
            clearInterval(activeIntervals[req.params.id]); 
            delete activeIntervals[req.params.id]; 
        }
        await Config.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error("Error DELETE /api/configs:", error.message);
        res.status(500).json({ error: "Gagal menghapus konfigurasi." });
    }
});

app.post('/api/configs/:id/toggle', async (req, res) => {
    try {
        const config = await Config.findById(req.params.id);
        if (!config) return res.status(404).json({ error: 'Config not found' });
        
        config.status = config.status === 'RUNNING' ? 'STOPPED' : 'RUNNING';
        await config.save();

        if (config.status === 'RUNNING') {
            startAutopost(config);
        } else {
            if (activeIntervals[config._id]) {
                clearInterval(activeIntervals[config._id]);
                delete activeIntervals[config._id];
            }
        }
        res.json({ success: true, status: config.status });
    } catch (error) {
        console.error("Error TOGGLE /api/configs:", error.message);
        res.status(500).json({ error: "Gagal mengubah status konfigurasi." });
    }
});

// Log API
let logs = [];
app.get('/api/logs', (req, res) => res.json(logs));
app.post('/api/logs', (req, res) => {
    logs.unshift(req.body);
    if(logs.length > 50) logs.pop();
    res.json({ success: true });
});

// --- MESIN AUTOPOST ---
async function startAutopost(config) {
    if (activeIntervals[config._id]) clearInterval(activeIntervals[config._id]);
    
    const tokenData = await Token.findById(config.tokenId);
    if (!tokenData) {
        console.log(`[ERROR] Token tidak ditemukan untuk config ${config.name}`);
        return;
    }

    const sendMessage = async () => {
        try {
            const messageContent = config.message || `Autopost dari config: ${config.name}`; 
            await axios.post(`https://discord.com/api/v9/channels/${config.channel}/messages`, 
                { content: messageContent },
                { headers: { 'Authorization': tokenData.token } }
            );
            config.sentCount += 1;
            await config.save();
            console.log(`[SUCCESS] ${config.name} mengirim pesan ke ${config.channel}`);
        } catch (error) {
            console.error(`[FAILED] ${config.name}:`, error.response?.data?.message || error.message);
        }
    };

    sendMessage();
    activeIntervals[config._id] = setInterval(sendMessage, config.delay * 1000);
    console.log(`[STARTED] Autopost untuk ${config.name} berjalan setiap ${config.delay} detik.`);
}

// --- RESUME SAAT RESTART ---
async function resumeRunningConfigs() {
    const runningConfigs = await Config.find({ status: 'RUNNING' });
    runningConfigs.forEach(config => {
        console.log(`[RESUME] Melanjutkan autopost: ${config.name}`);
        startAutopost(config);
    });
}

// --- PORT ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server berjalan di port ${PORT}`);
    await resumeRunningConfigs();
});
