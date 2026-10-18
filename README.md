# YT Clipper

Potong & download klip YouTube: paste link → pilih menit → pilih kualitas → download.

## Syarat
- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) dan ffmpeg terpasang di PATH
  - macOS: `brew install yt-dlp ffmpeg`
  - Ubuntu: `sudo apt install ffmpeg && pip install -U yt-dlp`

## Jalankan
```bash
cd yt-clipper
npm install
npm start
# buka http://localhost:3000
```

## Konfigurasi (env)
- `PORT` (default 3000)
- `MAX_CLIP_SEC` durasi klip maksimal (default 1800 = 30 menit)

## Catatan produksi
- Update yt-dlp rutin (`yt-dlp -U`), YouTube sering berubah.
- Tambah rate limit (mis. `express-rate-limit`) & antrean job jika ramai.
- Deploy di VPS (bukan serverless) karena proses ffmpeg lama & butuh disk temp.
- Download konten YouTube bisa melanggar ToS YouTube/hak cipta; batasi untuk konten milik sendiri/berlisensi.
