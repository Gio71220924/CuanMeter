# Sahamath

Sahamath adalah aplikasi web untuk trader saham Indonesia yang menggabungkan kalkulator saham, market calendar, bandarmology, screener swing, dan Analyzer ML dalam satu dashboard.

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

- Frontend: React UMD + Babel standalone
- Styling: CSS custom properties
- Backend: Node.js HTTP server
- ML runtime: Python
- Data eksternal: TradingView, api-saham, Yahoo Finance, KSEI, IDX, BI, BPS

## Struktur Project

```text
CuanMeter/
|-- index.html
|-- CSS/
|   `-- CuanMeter.css
|-- js/
|   `-- cuanmeter/
|       |-- app.jsx
|       |-- components.jsx
|       |-- landing.jsx
|       |-- calculators.jsx
|       |-- analyzer.jsx
|       |-- guides.jsx
|       `-- tradingview.jsx
|-- docs/
|   `-- sahamath-docs.md
|-- server.js
|-- predict.py
|-- screener.py
|-- best_models.pkl
|-- trading_model.pkl
`-- package.json
```

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

## Halaman Utama

Navigasi utama tersedia lewat hash route:

| Route | Halaman |
|---|---|
| `#/` | Home |
| `#/average` | Average Price |
| `#/araarb` | ARA/ARB |
| `#/profit` | Profit/Loss |
| `#/amunisi` | Position Sizing |
| `#/dividen` | Dividen Yield |
| `#/analyzer` | Analyzer + Screener |
| `#/guides` | Panduan Edukasi |

## API Backend

Base URL lokal:

```text
http://localhost:3000
```

### `GET /search`

Mencari simbol saham IDX.

Query:

| Param | Wajib | Contoh |
|---|---|---|
| `q` | Ya | `BBCA` |
| `exchange` | Tidak | `IDX` |

Contoh:

```text
GET /search?q=BBCA
```

### `GET /price`

Mengambil harga saham dari TradingView.

Query:

| Param | Wajib | Contoh |
|---|---|---|
| `ticker` | Ya | `BBCA` |

Contoh:

```text
GET /price?ticker=BBCA
```

### `GET /board`

Mengecek papan pencatatan saham.

Query:

| Param | Wajib | Contoh |
|---|---|---|
| `ticker` | Ya | `BBCA` |

Contoh:

```text
GET /board?ticker=BBCA
```

### `GET /bandarmology`

Mengambil data broker flow dari api-saham.

Query:

| Param | Wajib | Contoh |
|---|---|---|
| `ticker` | Ya | `BBCA` |
| `from` | Tidak | `2026-05-01` |
| `to` | Tidak | `2026-05-14` |

Contoh:

```text
GET /bandarmology?ticker=BBCA&from=2026-05-01&to=2026-05-14
```

### `GET /ml-predict`

Menjalankan prediksi ML untuk satu ticker.

Query:

| Param | Wajib | Contoh |
|---|---|---|
| `ticker` | Ya | `BBRI` |

Contoh:

```text
GET /ml-predict?ticker=BBRI
```

Endpoint ini menjalankan:

```text
python predict.py <ticker>
```

### `GET /screener`

Menjalankan screener swing untuk universe saham yang sudah ditentukan di `screener.py`.

Contoh:

```text
GET /screener
```

Endpoint ini menjalankan:

```text
python screener.py
```

### `GET /calendar`

Mengambil market calendar.

Query:

| Param | Wajib | Contoh |
|---|---|---|
| `range` | Tidak | `month` atau `week` |
| `week` | Tidak | `1`, `2`, `3`, `4` |
| `limit` | Tidak | `40` |
| `refresh` | Tidak | `1` |

Contoh:

```text
GET /calendar?range=month
GET /calendar?range=week&week=2
GET /calendar?range=month&refresh=1
```

Calendar memakai cache lokal:

```text
data/calendar-cache.json
```

Cache ini tidak wajib dipush ke repository.

### `GET /api/prices/stream`

Server-Sent Events untuk harga market marquee.

Contoh:

```text
GET /api/prices/stream
```

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

## Data dan Cache

File lokal yang sebaiknya tidak dipush:

```text
.venv/
venv/
env/
*.ipynb
*.pkl
data/calendar-cache.json
__pycache__/
*.pyc
```

Jika repo dibuat private dan model memang dibutuhkan untuk deploy backend, `best_models.pkl` boleh ikut repository private.

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

Perubahan yang dibutuhkan sebelum production deploy:

1. `server.js` membaca port dari `process.env.PORT`.
2. Buat `requirements.txt` untuk dependency Python.
3. Siapkan build static untuk Netlify.
4. Frontend memakai API base URL backend Render.
5. Tentukan strategi model: repo private, secret file, atau private storage.

## Dokumentasi Pengguna

Dokumentasi pengguna lengkap tersedia di:

```text
docs/sahamath-docs.md
```

Dokumen tersebut menjelaskan cara memakai kalkulator, Analyzer, Screener, Market Calendar, dan API publik dengan bahasa yang lebih ramah untuk pengguna akhir.

## Disclaimer

Sahamath bukan penasihat investasi. Data dari pihak ketiga dapat berubah, terlambat, atau gagal diakses. Selalu validasi ulang sebelum mengambil keputusan trading.
