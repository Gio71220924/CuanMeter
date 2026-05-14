# Sahamath

Sahamath adalah web kalkulator saham yang mudah dipakai untuk trader Indonesia. Mulai dari menghitung average price, batas ARA/ARB, profit/loss, position sizing, dividen, sampai membaca market calendar, bandarmology, screener swing, dan Analyzer ML.

> Bukan rekomendasi beli atau jual. Semua hasil kalkulator, screener, dan model ML dipakai sebagai alat bantu analisis. Tetap lakukan riset mandiri.

## Fitur

- **Average Price**: menghitung harga rata-rata dari beberapa transaksi beli.
- **ARA/ARB**: menghitung batas auto rejection berdasarkan harga saham dan papan pencatatan IDX.
- **Profit/Loss**: menghitung profit bersih setelah fee beli, fee jual, dan pajak.
- **Amunisi**: menghitung position sizing berdasarkan risiko per trade.
- **Dividen Yield**: menghitung yield dividen kotor dan bersih setelah PPh final.
- **Analyzer**: membaca harga, bandarmology, chart, trading plan, dan sinyal ML.
- **Screener IDX Energy**: mendeteksi kandidat swing dengan skor trend, VSA, entry, target price, dan stop loss.
- **Market Calendar**: menampilkan corporate action saham dan event makro Indonesia.
- **Panduan Edukasi**: artikel ringkas untuk pemula seputar ARA/ARB, average down, risk management, dividen, bandarmology, pajak, dan cut loss.

## Tech Stack

Sahamath memakai frontend ringan berbasis React tanpa bundler production yang kompleks. UI dimuat dari `index.html`, styling utama ada di CSS, dan routing memakai hash route di browser.

- **Frontend**: React UMD, ReactDOM UMD, Babel Standalone, HTML, CSS, JavaScript.
- **UI styling**: CSS custom properties, responsive layout, dark/light theme support.
- **Backend**: Node.js HTTP server lewat `server.js`.
- **ML runtime**: Python untuk menjalankan `predict.py` dan `screener.py`.
- **Model ML**: `best_models.pkl` sebagai model utama, dengan fallback ke `trading_model.pkl`.
- **Data market**: TradingView, api-saham, Yahoo Finance, KSEI, IDX, BI, dan BPS.

## Alur Sederhana Aplikasi

1. Pengguna membuka Sahamath di browser.
2. Frontend menampilkan halaman kalkulator, Analyzer, Screener, Market Calendar, atau Panduan Edukasi.
3. Untuk kalkulator sederhana seperti Average, Profit, Amunisi, dan Dividen, perhitungan dilakukan langsung di browser.
4. Untuk data saham seperti harga, papan pencatatan, calendar, bandarmology, Analyzer, dan Screener, frontend meminta data ke backend Node.js.
5. Backend mengambil data dari sumber eksternal seperti TradingView, KSEI, IDX, api-saham, atau Yahoo Finance.
6. Untuk Analyzer ML dan Screener, backend menjalankan script Python, membaca model `.pkl`, lalu mengembalikan hasil analisis ke frontend.
7. Frontend menampilkan hasil dalam bentuk trading plan, score, entry, target price, stop loss, broker flow, dan calendar event.

## Menjalankan di Lokal

Pastikan Node.js dan Python sudah terpasang.

```bash
npm install
npm start
```

Buka:

```text
http://localhost:3000
```

Untuk fitur Analyzer ML dan Screener, install dependency Python di virtual environment:

```bash
pip install pandas numpy scikit-learn yfinance ta joblib requests
```

File model yang dibutuhkan:

```text
best_models.pkl
```

`trading_model.pkl` hanya fallback untuk format model lama.

## Model ML

Runtime Analyzer dan Screener membaca model dari:

```text
best_models.pkl
```

Model terbaru memakai pendekatan universal-first:

- satu model default untuk banyak saham;
- fitur RS IHSG, VSA, trend, volatility, liquidity;
- fallback ke model lama jika format lama masih tersedia.

Karena model `.pkl` adalah artefak binary, jangan push ke repo public jika model ingin tetap private.

## Deployment

Rekomendasi deployment:

```text
Netlify  -> frontend static
Render   -> backend Node + Python + model ML
```

Catatan penting:

- Netlify tidak menjalankan `server.js` sebagai backend permanen.
- Backend perlu host terpisah seperti Render.
- Render Free bisa dipakai untuk personal project, tetapi bisa sleep saat idle dan cold start bisa lambat.
- Jika repo public, jangan push `best_models.pkl`.
- Jika ingin satu repo dan model tetap private, ubah repository menjadi private.

Environment variable yang perlu diisi di Render untuk download model dari Supabase private bucket:

```text
SUPABASE_URL=isi_project_url
SUPABASE_SERVICE_ROLE_KEY=isi_secret_key
SUPABASE_BUCKET=models
SUPABASE_MODEL_PATH=best_models.pkl
```

Render build command:

```bash
npm install && pip install -r requirements.txt && npm run download:model
```

Render start command:

```bash
npm start
```

## Dokumentasi Pengguna

Dokumentasi pengguna lengkap tersedia di:

```text
docs/sahamath-docs.md
```

Dokumen tersebut menjelaskan cara memakai kalkulator, Analyzer, Screener, Market Calendar, dan fitur edukasi dengan bahasa yang lebih ramah untuk pengguna akhir.

## Disclaimer

Sahamath bukan penasihat investasi. Data dari pihak ketiga dapat berubah, terlambat, atau gagal diakses. Selalu validasi ulang sebelum mengambil keputusan trading.
