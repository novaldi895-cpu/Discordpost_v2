const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- KONEKSI KE MONGODB ---
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI belum diisi di Railway Variables!");
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Terhubung ke MongoDB'))
  .catch(err => console.error('❌ Gagal koneksi MongoDB:', err));

// --- SKEMA DATABASE ---
const TokenSchema = new mongoose.Schema({
    token: String,
    username: String,
    createdAt: { type: Date, default: Date.now }
});

const ConfigSchema = new mongoose.Schema({
    name: String,
    tokenId: String,
    channel: String,
    delay: Number,
    status: { type: String, default: 'STOPPED' },
    sentCount: { type: Number, default: 0 }
});

const Token = mongoose.model('Token', TokenSchema);
const Config = mongoose.model('Config', ConfigSchema);

// --- PENYIMPANAN INTERVAL DI MEMORI ---
const activeIntervals = {};

// --- API ENDPOINTS ---
app.get('/api/tokens', async (req, res) => res.json(await Token.find()));
app.post('/api/tokens', async (req, res) => {
    const newToken = new Token({ token: req.body.token, username: `User_${Math.floor(Math.random()*1000)}` });
    await newToken.save();
    res.json({ success: true, token: newToken });
});
app.delete('/api/tokens/:id', async (req, res) => { await Token.findByIdAndDelete(req.params.id); res.json({ success: true }); });

app.get('/api/configs', async (req, res) => res.json(await Config.find()));
app.post('/api/configs', async (req, res) => {
    const newConfig = new Config(req.body);
    await newConfig.save();
    res.json({ success: true, config: newConfig });
});
app.delete('/api/configs/:id', async (req, res) => {
    if (activeIntervals[req.params.id]) { clearInterval(activeIntervals[req.params.id]); delete activeIntervals[req.params.id]; }
    await Config.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Endpoint Toggle (Play/Stop) - Ini yang memicu pengiriman pesan
app.post('/api/configs/:id/toggle', async (req, res) => {
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
            // Ganti teks ini dengan pesan yang ingin Anda kirim
            const messageContent = `Autopost dari config: ${config.name}`; 
            
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

    // Kirim pesan pertama kali
    sendMessage();

    // Set interval untuk pesan selanjutnya
    activeIntervals[config._id] = setInterval(sendMessage, config.delay * 1000);
    console.log(`[STARTED] Autopost untuk ${config.name} berjalan setiap ${config.delay} detik.`);
}

// --- SAAT SERVER RESTART, JALANKAN KEMBALI YANG STATUSNYA RUNNING ---
async function resumeRunningConfigs() {
    const runningConfigs = await Config.find({ status: 'RUNNING' });
    runningConfigs.forEach(config => {
        console.log(`[RESUME] Melanjutkan autopost: ${config.name}`);
        startAutopost(config);
    });
}

// --- PORT RAILWAY ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server berjalan di port ${PORT}`);
    await resumeRunningConfigs(); // Jalankan kembali autopost yang sebelumnya aktif
});
