# predict.py Update — Multi-Model + Bandarmology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `predict.py` to load 14 per-emiten SVM models from `best_models.pkl`, add bandarmology indicator features (CMF, MFI, vol_ratio, close_pos), merge broker flow data into the prediction response, and fall back to a universal model for unknown tickers.

**Architecture:** `server.js` spawns `predict.py <ticker>` as a subprocess. `predict.py` loads `best_models.pkl` (dict of 14 per-emiten models + `universal` key), selects the right model, computes OHLCV indicators + new bandarmology features, fetches broker flow from `api-saham`, and returns a unified JSON to stdout. No changes needed to `server.js`.

**Tech Stack:** Python 3.10+, scikit-learn, joblib, yfinance, ta, pandas, requests

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `predict.py` | Modify | Full prediction pipeline — model loading, indicators, bandarmology, response |
| `best_models.pkl` | New (from notebook) | Serialized dict of 14 per-emiten models + universal fallback |
| `trading_model.pkl` | Keep | Legacy fallback if `best_models.pkl` not found |

---

### Task 1: Tambah Cell Export ke Notebook (Manual di Colab)

**Files:**
- Modify: `TA2_fix_ATR - Cadangan (TA  TA) - NO SL NO TP.ipynb` (manual di Colab)

Karena notebook dijalankan di Google Colab, cell ini harus ditambah manual. Ini kode yang perlu ditambah sebagai cell baru di akhir notebook setelah cell training `best_models`.

- [ ] **Step 1: Tambah cell universal model training di notebook**

Tambah cell baru di Colab setelah cell yang mengisi `best_models`:

```python
# =====================================
# EXPORT: Universal Model + best_models.pkl
# =====================================
import joblib
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

# Gabungkan semua data dev jadi satu dataset
all_dev_frames = []
for t in tickers:
    if t in dev_all:
        frame = dev_all[t].copy()
        frame['ticker'] = t
        all_dev_frames.append(frame)

all_dev_combined = pd.concat(all_dev_frames).sort_index()

# Fitur universal (subset yang pasti ada di semua emiten)
universal_features = ['BB_MIDDLE', 'BB_UPPER', 'BB_LOWER', 'STOCH_%K', 'STOCH_%D', 'OBV', 'ADX']
UNIVERSAL_HORIZON = 5

# Hitung ATR_pct jika belum ada
if 'ATR_pct' not in all_dev_combined.columns:
    from ta.volatility import AverageTrueRange
    atr_ind = AverageTrueRange(
        high=all_dev_combined['High'],
        low=all_dev_combined['Low'],
        close=all_dev_combined['Close'],
        window=14
    )
    all_dev_combined['ATR'] = atr_ind.average_true_range()
    all_dev_combined['ATR_pct'] = all_dev_combined['ATR'] / all_dev_combined['Close']

# Label universal
all_dev_combined['label_universal'] = make_labels_atr(all_dev_combined, UNIVERSAL_HORIZON, ATR_MULTIPLIER)

# Train
train_u = all_dev_combined[universal_features + ['label_universal']].dropna()
X_u = train_u[universal_features].values
y_u = train_u['label_universal'].values

universal_pipeline = Pipeline([
    ('scaler', StandardScaler()),
    ('svc', SVC(kernel='rbf', C=1.0, gamma='scale', class_weight='balanced', probability=True))
])
universal_pipeline.fit(X_u, y_u)

print("Universal model trained. Distribusi label:", pd.Series(y_u).value_counts().to_dict())

# Tambah ke best_models
best_models['universal'] = {
    'model': universal_pipeline,
    'features': universal_features,
    'horizon': UNIVERSAL_HORIZON,
    'kernel': 'rbf',
    'combo_name': 'BB, Stochastic, OBV, ADX',
}

# Export
export_path = '/content/drive/My Drive/best_models.pkl'
joblib.dump(best_models, export_path)
print(f"✅ best_models.pkl disimpan ke: {export_path}")
print(f"Keys: {list(best_models.keys())}")
```

- [ ] **Step 2: Jalankan cell dan verifikasi output**

Output yang diharapkan:
```
Universal model trained. Distribusi label: {0: 1234, 1: 567, -1: 456}
✅ best_models.pkl disimpan ke: /content/drive/My Drive/best_models.pkl
Keys: ['ADRO', 'AKRA', 'BUMI', 'BYAN', 'DEWA', 'DSSA', 'ENRG', 'GEMS', 'ITMG', 'MEDC', 'PGAS', 'PTBA', 'PTRO', 'RAJA', 'universal']
```

- [ ] **Step 3: Download `best_models.pkl` dari Google Drive ke `G:\CuanMeter\`**

Di Colab, file ada di `/content/drive/My Drive/best_models.pkl`. Download dan letakkan di `G:\CuanMeter\best_models.pkl` (folder yang sama dengan `predict.py` dan `server.js`).

---

### Task 2: Update predict.py — Model Loader

**Files:**
- Modify: `G:\CuanMeter\predict.py`

- [ ] **Step 1: Ganti bagian import dan fungsi load model**

Ganti seluruh isi `predict.py` dengan versi baru. Mulai dari imports:

```python
import sys
import json
import warnings
import joblib
import pandas as pd
import numpy as np
import requests
import yfinance as yf
from datetime import datetime, timedelta

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

from ta.volatility import BollingerBands, AverageTrueRange
from ta.momentum import StochasticOscillator
from ta.volume import OnBalanceVolumeIndicator, ChaikinMoneyFlowIndicator, MFIIndicator
from ta.trend import ADXIndicator

# ─── Model Loader ────────────────────────────────────────────────────────────
def load_models():
    """Load best_models.pkl (multi-model). Fallback ke trading_model.pkl lama."""
    try:
        bundle = joblib.load('best_models.pkl')
        # Validasi: harus dict dengan key 'universal'
        if isinstance(bundle, dict) and 'universal' in bundle:
            return bundle, 'multi'
        raise ValueError("Format best_models.pkl tidak valid")
    except Exception:
        pass

    try:
        old = joblib.load('trading_model.pkl')
        # Wrap ke format multi-model dengan key 'universal'
        return {'universal': {'model': old['model'], 'features': old['features'], 'horizon': 5}}, 'legacy'
    except Exception:
        return None, None


def select_model(models, ticker):
    """Pilih model per-emiten jika ada, fallback ke universal."""
    if ticker.upper() in models:
        return models[ticker.upper()], 'per_emiten'
    if 'universal' in models:
        return models['universal'], 'universal'
    return None, None
```

- [ ] **Step 2: Verifikasi loader manual**

Buat file tes sementara `test_loader.py` di `G:\CuanMeter\`:

```python
import sys
sys.path.insert(0, '.')
from predict import load_models, select_model

models, mode = load_models()
print("Mode:", mode)
print("Keys:", list(models.keys()) if models else "GAGAL")

info, mtype = select_model(models, "ADRO")
print("ADRO model type:", mtype, "| features:", info['features'][:3])

info2, mtype2 = select_model(models, "BBCA")
print("BBCA model type:", mtype2)
```

Jalankan:
```
cd G:\CuanMeter
python test_loader.py
```

Expected output:
```
Mode: multi
Keys: ['ADRO', 'AKRA', ..., 'universal']
ADRO model type: per_emiten | features: ['BB_MIDDLE', 'BB_UPPER', 'BB_LOWER']
BBCA model type: universal
```

- [ ] **Step 3: Commit**

```
git add predict.py
git commit -m "feat: add multi-model loader to predict.py"
```

---

### Task 3: Update predict.py — Indicator Calculations

**Files:**
- Modify: `G:\CuanMeter\predict.py`

- [ ] **Step 1: Tambah fungsi kalkulasi indikator lengkap**

Tambah fungsi `calculate_indicators` setelah fungsi `select_model`:

```python
def calculate_indicators(df):
    """Hitung semua indikator teknikal + fitur bandarmology dari OHLCV."""
    close  = df['Close'].squeeze()
    high   = df['High'].squeeze()
    low    = df['Low'].squeeze()
    volume = df['Volume'].squeeze()

    # ── Existing indicators ──────────────────────────────────────────────────
    bb = BollingerBands(close=close, window=20, window_dev=2)
    df['BB_MIDDLE'] = bb.bollinger_mavg()
    df['BB_UPPER']  = bb.bollinger_hband()
    df['BB_LOWER']  = bb.bollinger_lband()

    stoch = StochasticOscillator(high=high, low=low, close=close, window=14, smooth_window=3)
    df['STOCH_%K'] = stoch.stoch()
    df['STOCH_%D'] = stoch.stoch_signal()

    adx = ADXIndicator(high=high, low=low, close=close, window=14)
    df['ADX']     = adx.adx()
    df['ADX_POS'] = adx.adx_pos()
    df['ADX_NEG'] = adx.adx_neg()

    df['OBV'] = OnBalanceVolumeIndicator(close=close, volume=volume).on_balance_volume()

    atr = AverageTrueRange(high=high, low=low, close=close, window=14)
    df['ATR']     = atr.average_true_range()
    df['ATR_pct'] = df['ATR'] / df['Close']

    # ── New bandarmology features ─────────────────────────────────────────────
    vol_mean = volume.rolling(20).mean()
    vol_std  = volume.rolling(20).std()

    df['vol_ratio']  = volume / vol_mean.replace(0, np.nan)
    df['vol_zscore'] = (volume - vol_mean) / vol_std.replace(0, np.nan)
    df['close_pos']  = (close - low) / (high - low + 1e-9)

    df['CMF'] = ChaikinMoneyFlowIndicator(
        high=high, low=low, close=close, volume=volume, window=20
    ).chaikin_money_flow()

    df['MFI'] = MFIIndicator(
        high=high, low=low, close=close, volume=volume, window=14
    ).money_flow_index()

    return df
```

- [ ] **Step 2: Verifikasi kalkulasi indikator**

Tambah ke `test_loader.py`:

```python
import yfinance as yf
from predict import calculate_indicators

df = yf.download("ADRO.JK", period="60d", interval="1d", progress=False, auto_adjust=False)
if isinstance(df.columns, pd.MultiIndex):
    df.columns = df.columns.get_level_values(0)
df = calculate_indicators(df)

print("Kolom baru:", [c for c in ['CMF','MFI','vol_ratio','close_pos'] if c in df.columns])
print("Nilai terakhir CMF:", round(df['CMF'].iloc[-1], 4))
print("Nilai terakhir vol_ratio:", round(df['vol_ratio'].iloc[-1], 2))
```

Jalankan:
```
python test_loader.py
```

Expected:
```
Kolom baru: ['CMF', 'MFI', 'vol_ratio', 'close_pos']
Nilai terakhir CMF: 0.xxxx
Nilai terakhir vol_ratio: x.xx
```

- [ ] **Step 3: Commit**

```
git add predict.py
git commit -m "feat: add CMF, MFI, vol_ratio, close_pos indicators to predict.py"
```

---

### Task 4: Update predict.py — Bandarmology Fetch

**Files:**
- Modify: `G:\CuanMeter\predict.py`

- [ ] **Step 1: Tambah fungsi fetch bandarmology**

Tambah setelah `calculate_indicators`:

```python
def fetch_bandarmology(ticker):
    """Ambil net foreign flow + top broker dari api-saham. Return None jika gagal."""
    try:
        today     = datetime.now().strftime('%Y-%m-%d')
        from_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        url = (
            f"https://api-saham.mkemalw.workers.dev/cache-summary"
            f"?symbol={ticker}&from={from_date}&to={today}"
            f"&include_orderflow=false&cache=off"
        )
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()

        net_foreign = 0.0
        net_local   = 0.0
        net_retail  = 0.0
        last_price  = None

        for entry in data.get('history', []):
            d = entry.get('data', {})
            net_foreign += float(d.get('foreign', {}).get('net_val', 0) or 0)
            net_local   += float(d.get('local',   {}).get('net_val', 0) or 0)
            net_retail  += float(d.get('retail',  {}).get('net_val', 0) or 0)
            if d.get('price'):
                last_price = d['price']

        def map_broker(b):
            bval = float(b.get('bval') or 0)
            sval = float(b.get('sval') or 0)
            bvol = float(b.get('bvol') or 0)
            return {
                'code':     b.get('code', ''),
                'type':     b.get('type', ''),
                'netVal':   round(bval - sval, 0),
                'avgPrice': round(bval / bvol) if bvol > 0 else 0,
            }

        buyers  = sorted(
            [map_broker(b) for b in data.get('summary', {}).get('top_buyers',  [])[:5]],
            key=lambda x: x['netVal'], reverse=True
        )
        sellers = sorted(
            [map_broker(b) for b in data.get('summary', {}).get('top_sellers', [])[:5]],
            key=lambda x: x['netVal']
        )

        return {
            'net_foreign': round(net_foreign, 0),
            'net_local':   round(net_local,   0),
            'net_retail':  round(net_retail,  0),
            'last_price':  last_price,
            'top_buyers':  buyers,
            'top_sellers': sellers,
        }

    except Exception:
        return None
```

- [ ] **Step 2: Verifikasi fetch bandarmology**

Tambah ke `test_loader.py`:

```python
from predict import fetch_bandarmology

band = fetch_bandarmology("ADRO")
if band:
    print("net_foreign:", band['net_foreign'])
    print("top_buyers:", band['top_buyers'][:2])
else:
    print("Bandarmology: gagal/timeout (normal jika offline)")
```

Jalankan:
```
python test_loader.py
```

Expected (jika online):
```
net_foreign: 5200000000.0
top_buyers: [{'code': 'BK', 'type': 'foreign', 'netVal': ...}]
```

- [ ] **Step 3: Commit**

```
git add predict.py
git commit -m "feat: add fetch_bandarmology function to predict.py"
```

---

### Task 5: Update predict.py — Fungsi Prediksi Utama + Response

**Files:**
- Modify: `G:\CuanMeter\predict.py`

- [ ] **Step 1: Tulis fungsi `get_prediction` lengkap**

Ganti fungsi `get_prediction` yang lama dengan versi ini:

```python
def get_prediction(ticker):
    try:
        # 1. Load & pilih model
        models, load_mode = load_models()
        if models is None:
            return {"status": "error", "message": "Tidak ada model tersedia (best_models.pkl / trading_model.pkl)"}

        model_info, model_type = select_model(models, ticker)
        if model_info is None:
            return {"status": "error", "message": f"Tidak ada model untuk {ticker}"}

        svm_model      = model_info['model']
        feature_cols   = model_info['features']
        horizon        = model_info.get('horizon', 5)

        # 2. Download OHLCV
        fmt_ticker = f"{ticker}.JK" if not ticker.upper().endswith('.JK') else ticker
        df = yf.download(
            fmt_ticker, period="100d", interval="1d",
            progress=False, auto_adjust=False
        )

        if df.empty or len(df) < 30:
            return {"status": "error", "message": f"Data {ticker} tidak cukup (< 30 hari)."}

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        for col in ['Open', 'High', 'Low', 'Close', 'Volume']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        df.ffill(inplace=True)
        df.bfill(inplace=True)

        # 3. Hitung indikator
        df = calculate_indicators(df)
        df.dropna(inplace=True)

        if len(df) < 10:
            return {"status": "error", "message": f"Data {ticker} tidak cukup setelah kalkulasi indikator."}

        # 4. Prediksi history (60 hari terakhir)
        history_df = df.tail(60).copy()
        available_features = [f for f in feature_cols if f in history_df.columns]
        X_history = history_df[available_features].ffill().fillna(0).values

        history_preds = svm_model.predict(X_history)
        history_df = history_df.iloc[-len(history_preds):]
        history_df = history_df.copy()
        history_df['pred'] = history_preds

        # 5. Win rate & recent trades
        wins          = 0
        total_signals = 0
        trade_details = []

        for i in range(len(history_df) - horizon):
            sig = int(history_df['pred'].iloc[i])
            if sig != 0:
                total_signals   += 1
                current_price    = float(history_df['Close'].iloc[i])
                future_price     = float(history_df['Close'].iloc[i + horizon])
                date_str         = history_df.index[i].strftime('%d %b')
                is_win           = (sig == 1 and future_price > current_price) or \
                                   (sig == -1 and future_price < current_price)
                if is_win:
                    wins += 1
                profit_pct = ((future_price - current_price) / current_price * 100) \
                             if sig == 1 \
                             else ((current_price - future_price) / current_price * 100)
                trade_details.append({
                    "date":       date_str,
                    "signal":     "BUY" if sig == 1 else "SELL",
                    "price":      current_price,
                    "result":     "WIN" if is_win else "LOSS",
                    "profit_pct": round(profit_pct, 2),
                })

        win_rate     = round(wins / total_signals * 100, 1) if total_signals > 0 else 0
        recent_trades = list(reversed(trade_details[-5:]))

        # 6. Trading plan (baris terakhir)
        last_price = float(df['Close'].iloc[-1])
        atr_val    = float(df['ATR'].iloc[-1])
        last_pred  = int(history_preds[-1])

        if last_pred == 1:
            plan = {
                "entry":          round(last_price, 0),
                "target_profit":  round(last_price + atr_val * 2,   0),
                "stop_loss":      round(last_price - atr_val * 1.5, 0),
                "tp_percent":     round(atr_val * 2   / last_price * 100, 2),
                "sl_percent":     round(-atr_val * 1.5 / last_price * 100, 2),
                "note":           "Kondisi Bullish. Potensi kenaikan terdeteksi.",
            }
        elif last_pred == -1:
            plan = {
                "entry":          round(last_price, 0),
                "target_profit":  round(last_price - atr_val * 2,   0),
                "stop_loss":      round(last_price + atr_val * 1.5, 0),
                "tp_percent":     round(-atr_val * 2   / last_price * 100, 2),
                "sl_percent":     round(atr_val * 1.5  / last_price * 100, 2),
                "note":           "Kondisi Bearish. Hindari spekulasi beli.",
            }
        else:
            plan = {
                "entry":         round(last_price, 0),
                "target_profit": 0,
                "stop_loss":     0,
                "tp_percent":    0,
                "sl_percent":    0,
                "note":          "Sideways. Harga bergerak di rentang sempit.",
            }

        # 7. Strength (confidence)
        try:
            X_last = history_df[available_features].iloc[[-1]].ffill().fillna(0).values
            proba  = svm_model.predict_proba(X_last)[0]
            strength = float(max(proba))
        except Exception:
            try:
                scores   = svm_model.decision_function(X_last)[0]
                strength = float(max(abs(scores)) if hasattr(scores, '__len__') else abs(scores))
            except Exception:
                strength = 0.0

        # 8. Fetch bandarmology
        band = fetch_bandarmology(ticker)

        # 9. Chart history
        chart_data = [
            {
                "time":   idx.strftime('%Y-%m-%d'),
                "open":   float(row['Open']),
                "high":   float(row['High']),
                "low":    float(row['Low']),
                "close":  float(row['Close']),
                "signal": int(row['pred']),
            }
            for idx, row in history_df.iterrows()
        ]

        # 10. Susun response
        last = df.iloc[-1]
        bb_pos = (
            "Overbought" if float(last['Close']) > float(last['BB_UPPER'])
            else "Oversold" if float(last['Close']) < float(last['BB_LOWER'])
            else "Normal"
        )

        return {
            "status":      "success",
            "ticker":      ticker.upper(),
            "model_type":  model_type,
            "prediction":  "UP" if last_pred == 1 else "DOWN" if last_pred == -1 else "NEUTRAL",
            "strength":    round(strength, 2),
            "win_rate":    win_rate,
            "trading_plan": plan,
            "indicators": {
                "stoch":     round(float(last['STOCH_%K']), 2),
                "bb_pos":    bb_pos,
                "adx":       round(float(last['ADX']), 2),
                "obv":       round(float(last['OBV']), 0),
                "cmf":       round(float(last['CMF']), 4)      if 'CMF'       in last.index else None,
                "mfi":       round(float(last['MFI']), 2)      if 'MFI'       in last.index else None,
                "vol_ratio": round(float(last['vol_ratio']), 2) if 'vol_ratio' in last.index else None,
                "close_pos": round(float(last['close_pos']), 2) if 'close_pos' in last.index else None,
            },
            "bandarmology":  band,
            "chart_history": chart_data,
            "recent_trades": recent_trades,
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    ticker_input = sys.argv[1] if len(sys.argv) > 1 else "BBCA"
    print(json.dumps(get_prediction(ticker_input)))
```

- [ ] **Step 2: Jalankan end-to-end test untuk emiten yang ada di model**

```
cd G:\CuanMeter
python predict.py ADRO
```

Expected output (JSON valid, tidak ada error):
```json
{
  "status": "success",
  "ticker": "ADRO",
  "model_type": "per_emiten",
  "prediction": "UP",
  ...
}
```

- [ ] **Step 3: Jalankan end-to-end test untuk emiten di luar 14 (universal fallback)**

```
python predict.py BBCA
```

Expected:
```json
{
  "status": "success",
  "ticker": "BBCA",
  "model_type": "universal",
  "prediction": "...",
  ...
}
```

- [ ] **Step 4: Test via server.js (full integration)**

Pastikan `server.js` sedang jalan (`npm start`), lalu buka browser:
```
http://localhost:3000/ml-predict?ticker=ADRO
http://localhost:3000/ml-predict?ticker=BBCA
```

Keduanya harus return JSON valid dengan `"status": "success"`.

- [ ] **Step 5: Hapus file test sementara**

```
del G:\CuanMeter\test_loader.py
```

- [ ] **Step 6: Commit final**

```
git add predict.py
git commit -m "feat: update predict.py - multi-model, bandarmology features, unified response"
```

---

## Checklist Pasca-Implementasi

- [ ] `best_models.pkl` ada di `G:\CuanMeter\` dan berisi 15 keys (14 emiten + universal)
- [ ] `python predict.py ADRO` → `model_type: "per_emiten"`
- [ ] `python predict.py BBCA` → `model_type: "universal"`
- [ ] Response mengandung `indicators.cmf`, `indicators.vol_ratio`
- [ ] Response mengandung `bandarmology` (atau `null` jika offline)
- [ ] `server.js` tidak perlu diubah — `/ml-predict` tetap jalan
