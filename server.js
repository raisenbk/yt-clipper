// YT Clipper - backend (Node.js + yt-dlp + ffmpeg)
const express = require('express');
const { execFile, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_CLIP_SEC = Number(process.env.MAX_CLIP_SEC || 1800); // maks 30 menit per klip
const YT_RE = /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)[\w-]{11}/;

app.use(express.static(path.join(__dirname, 'public')));

const isYT = (u) => typeof u === 'string' && YT_RE.test(u);

// 1) Info video: judul, durasi, thumbnail, daftar kualitas
app.get('/api/info', (req, res) => {
  const { url } = req.query;
  if (!isYT(url)) return res.status(400).json({ error: 'Link YouTube tidak valid.' });

  execFile('yt-dlp', ['-J', '--no-playlist', url], { maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Gagal membaca video. Pastikan video publik.' });
    try {
      const d = JSON.parse(stdout);
      const heights = [...new Set(
        (d.formats || []).filter(f => f.vcodec && f.vcodec !== 'none' && f.height).map(f => f.height)
      )].filter(h => h >= 144).sort((a, b) => b - a);
      res.json({ id: d.id, title: d.title, duration: d.duration, thumbnail: d.thumbnail, qualities: heights });
    } catch {
      res.status(500).json({ error: 'Data video tidak terbaca.' });
    }
  });
});

// 2) Potong + download
app.get('/api/download', (req, res) => {
  const { url } = req.query;
  const start = Number(req.query.start), end = Number(req.query.end);
  const height = req.query.height === 'audio' ? 'audio' : parseInt(req.query.height, 10);

  if (!isYT(url)) return res.status(400).json({ error: 'Link YouTube tidak valid.' });
  if (!(start >= 0 && end > start)) return res.status(400).json({ error: 'Rentang waktu tidak valid.' });
  if (end - start > MAX_CLIP_SEC) return res.status(400).json({ error: `Durasi klip maksimal ${MAX_CLIP_SEC / 60} menit.` });
  if (height !== 'audio' && !(height >= 144 && height <= 4320)) return res.status(400).json({ error: 'Kualitas tidak valid.' });

  const id = crypto.randomBytes(6).toString('hex');
  const ext = height === 'audio' ? 'mp3' : 'mp4';
  const out = path.join(os.tmpdir(), `clip-${id}.${ext}`);
  const format = height === 'audio'
    ? ['-f', 'ba', '-x', '--audio-format', 'mp3']
    : ['-f', `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]/bv*[height<=${height}]+ba/b[height<=${height}]`,
       '--merge-output-format', 'mp4'];

  const args = [
    '--no-playlist',
    '--download-sections', `*${start}-${end}`,
    '--force-keyframes-at-cuts', // potongan presisi (re-encode di titik potong)
    ...format,
    '-o', out, url,
  ];

  const p = spawn('yt-dlp', args);
  let errLog = '';
  p.stderr.on('data', (c) => { errLog += c; });
  req.on('close', () => { if (!res.writableEnded) p.kill('SIGKILL'); });

  p.on('close', (code) => {
    if (code !== 0 || !fs.existsSync(out)) {
      console.error(errLog.slice(-800));
      if (!res.headersSent) res.status(500).json({ error: 'Gagal memproses klip. Coba kualitas lebih rendah.' });
      return;
    }
    const name = `clip_${start}-${end}${height === 'audio' ? '' : '_' + height + 'p'}.${ext}`;
    res.download(out, name, () => fs.unlink(out, () => {}));
  });
});

app.listen(PORT, () => console.log(`YT Clipper jalan di http://localhost:${PORT}`));
