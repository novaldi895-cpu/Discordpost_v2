const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose'); // Tambahkan mongoose

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- KONEKSI KE MONGODB ---
// Ganti 'mongodb+srv://...' dengan link dari MongoDB Atlas Anda
// Kita gunakan process.env.MONGODB_URI agar aman (nanti diisi di Railway)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:rahasia123@cluster0.xxxxx.mongodb.net/discordbot?retryWrites=true&w=majority';

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

// --- API ENDPOINTS ---

// 1. Token API
app.get('/api/tokens', async (req, res) => {
    const tokens = await Token.find();
    res.json(tokens);
});

app.post('/api/tokens', async (req, res) => {
    const { token } = req.body;
    const newToken = new Token({
        token: token,
        username: `User_${Math.floor(Math.random()*1000)}`
    });
    await newToken.save();
    res.json({ success: true, token: newToken });
});

app.delete('/api/tokens/:id', async (req, res) => {
    await Token.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// 2. Config API
app.get('/api/configs', async (req, res) => {
    const configs = await Config.find();
    res.json(configs);
});

app.post('/api/configs', async (req, res) => {
    const { name, tokenId, channel, delay } = req.body;
    const newConfig = new Config({ name, tokenId, channel, delay });
    await newConfig.save();
    res.json({ success: true, config: newConfig });
});

app.post('/api/configs/:id/toggle', async (req, res) => {
    const config = await Config.findById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Not found' });
    
    config.status = config.status === 'RUNNING' ? 'STOPPED' : 'RUNNING';
    await config.save();
    res.json({ success: true, status: config.status });
});

app.delete('/api/configs/:id', async (req, res) => {
    await Config.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// 3. Log API (Simulasi, kita simpan di memori saja sementara)
let logs = [];
app.get('/api/logs', (req, res) => res.json(logs));
app.post('/api/logs', (req, res) => {
    logs.unshift(req.body);
    if(logs.length > 50) logs.pop();
    res.json({ success: true });
});

// --- PORT RAILWAY ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server berjalan di port ${PORT}`));
