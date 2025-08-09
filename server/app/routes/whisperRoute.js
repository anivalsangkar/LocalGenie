// server/app/routes/whisperRoute.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Use memory storage for symmetry with openaiRoute
const upload = multer({ storage: multer.memoryStorage() });

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Audio file is required' });

    const MIN_BYTES = 2000;
    if (!req.file.buffer || req.file.size < MIN_BYTES) {
      return res.json({ transcript: '', warning: 'no_text' });
    }

    const mt = req.file.mimetype || '';
    const ext = /ogg/.test(mt) ? 'ogg' : 'webm';
    const tempDir = path.join(__dirname, '../temp');
    const audioPath = path.join(tempDir, `audio-${Date.now()}.${ext}`);

    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(audioPath, req.file.buffer);

    const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';
    const domainPrompt = "LocalGenie assistant about neighborhoods, relocation, weather, safety, schools, commute, and local places in US cities such as Chicago, New York, San Francisco.";

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model,
      prompt: domainPrompt,
      language: 'en',
      temperature: 0
    });

    try { fs.unlinkSync(audioPath); } catch {}

    const text = (transcription?.text || '').trim();
    if (!text) return res.json({ transcript: '', warning: 'no_text' });

    res.json({ transcript: text });
  } catch (error) {
    console.error('Whisper error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

module.exports = router;
