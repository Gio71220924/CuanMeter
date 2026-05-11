# Design: predict.py Update — Multi-Model + Bandarmology Features

**Date:** 2026-05-11  
**Status:** Approved

---

## Context

CuanMeter has an existing ML pipeline:
- `server.js` (Node.js) spawns `predict.py` via `child_process.spawn`
- `predict.py` loads a single `trading_model.pkl`, downloads OHLCV from yfinance, runs SVM, returns JSON
- Current model is a single generic SVM — not the 14 per-emiten models from the TA notebook

This update upgrades `predict.py` to:
1. Load 14 per-emiten SVM models from notebook
2. Add bandarmology features (CMF, MFI, vol_ratio, close_pos) to indicator calculations
3. Merge bandarmology broker flow data into the ML prediction response
4. Fall back to a universal model for tickers outside the 14

---

## Architecture

```
Notebook (Google Colab)
  └─ joblib.dump(best_models, 'best_models.pkl')
          ↓  (copy to project root)
G:\CuanMeter\best_models.pkl
          ↓
predict.py
  ├─ load best_models.pkl
  ├─ select model (per-emiten or universal fallback)
  ├─ download OHLCV via yfinance (100d)
  ├─ calculate indicators (existing + new)
  ├─ fetch bandarmology from api-saham (7d window)
  ├─ run model.predict() + predict_proba()
  └─ return unified JSON
          ↑
server.js /ml-predict endpoint
  └─ spawn predict.py <ticker>
```

---

## PKL Format

Single file `best_models.pkl` with the following structure:

```python
{
  "ADRO": {
    "model": Pipeline(StandardScaler + SVC),
    "features": ["BB_MIDDLE", "BB_UPPER", "BB_LOWER", ...],
    "horizon": 5,
    "kernel": "rbf",
  },
  # ... 13 other tickers ...
  "universal": {
    "model": Pipeline(StandardScaler + SVC),
    "features": ["BB_MIDDLE", "BB_UPPER", "BB_LOWER", ...],
    "horizon": 5,
  }
}
```

The `universal` model is trained on all 14 emiten combined (dev period 2015–2022).

**Notebook export cell (add at end of notebook):**
```python
import joblib

# Train universal model (gabungan semua emiten)
all_dev = pd.concat([dev_all[t].assign(ticker=t) for t in tickers])
best_feature_cols_universal = ['BB_MIDDLE', 'BB_UPPER', 'BB_LOWER', 'STOCH_%K', 'STOCH_%D', 'OBV', 'ADX']
all_dev['label_universal'] = make_labels_atr(all_dev, horizon=5)
train_universal = all_dev[best_feature_cols_universal + ['label_universal']].dropna()

universal_model = Pipeline([
    ('scaler', StandardScaler()),
    ('svc', SVC(kernel='rbf', C=1.0, gamma='scale', class_weight='balanced', probability=True))
])
universal_model.fit(train_universal[best_feature_cols_universal], train_universal['label_universal'])

best_models['universal'] = {
    'model': universal_model,
    'features': best_feature_cols_universal,
    'horizon': 5,
    'kernel': 'rbf',
}

joblib.dump(best_models, 'best_models.pkl')
print("best_models.pkl exported:", list(best_models.keys()))
```

---

## New Indicator Features

Added to `predict.py` indicator calculation block:

| Feature | Formula | Purpose |
|---------|---------|---------|
| `vol_ratio` | `Volume / Volume.rolling(20).mean()` | Volume spike detector |
| `vol_zscore` | `(Volume - mean) / std` rolling 20 | Statistical anomaly |
| `close_pos` | `(Close - Low) / (High - Low)` | Intraday buying pressure |
| `CMF` | `ChaikinMoneyFlowIndicator(window=20)` | Money flow direction |
| `MFI` | `MFIIndicator(window=14)` | Volume-weighted momentum |

**Backward compatibility:** New features are only used if present in `model['features']`. Existing models without these features continue to work unchanged.

---

## Model Selection Logic

```python
ticker_upper = ticker.upper()
if ticker_upper in best_models:
    model_info = best_models[ticker_upper]
    model_type = "per_emiten"
elif "universal" in best_models:
    model_info = best_models["universal"]
    model_type = "universal"
else:
    return {"status": "error", "message": "Model tidak tersedia"}
```

---

## Response Format

```json
{
  "status": "success",
  "ticker": "ADRO",
  "model_type": "per_emiten",
  "prediction": "UP",
  "strength": 0.87,
  "win_rate": 68.5,
  "trading_plan": {
    "entry": 2850,
    "target_profit": 3100,
    "stop_loss": 2700,
    "tp_percent": 8.77,
    "sl_percent": -5.26,
    "note": "Kondisi Bullish. Potensi kenaikan terdeteksi."
  },
  "indicators": {
    "stoch": 72.3,
    "bb_pos": "Normal",
    "adx": 28.4,
    "obv": 12500000,
    "cmf": 0.15,
    "mfi": 65.2,
    "vol_ratio": 1.8,
    "close_pos": 0.72
  },
  "bandarmology": {
    "net_foreign": 5200000000,
    "net_local": -3100000000,
    "net_retail": -2100000000,
    "top_buyers": [
      { "code": "BK", "type": "foreign", "netVal": 3200000000, "avgPrice": 2840 }
    ],
    "top_sellers": [
      { "code": "YU", "type": "foreign", "netVal": -1800000000, "avgPrice": 2860 }
    ]
  },
  "chart_history": [],
  "recent_trades": []
}
```

---

## Error Handling

| Scenario | Response |
|----------|---------|
| `best_models.pkl` tidak ada | fallback ke `trading_model.pkl` lama |
| Ticker tidak di 14 + tidak ada universal | `{"status": "error", "message": "..."}` |
| yfinance data < 30 hari | `{"status": "error", "message": "Data tidak cukup"}` |
| api-saham timeout | bandarmology fields diisi `null`, tetap return prediksi |
| Feature mismatch model vs data | skip fitur baru, gunakan fitur yang tersedia |

---

## Files Modified

| File | Action |
|------|--------|
| `predict.py` | Update — multi-model loader, new features, merged bandarmology |
| Notebook (`.ipynb`) | Tambah cell export universal model + `joblib.dump` |
| `best_models.pkl` | New file — generated dari notebook, copy ke project root |
| `trading_model.pkl` | Tetap ada sebagai legacy fallback |
