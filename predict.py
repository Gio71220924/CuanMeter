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

# ─── Model Loader ─────────────────────────────────────────────────────────────

def load_models():
    """Load best_models.pkl (multi-model). Fallback ke trading_model.pkl lama."""
    try:
        bundle = joblib.load('best_models.pkl')
        if isinstance(bundle, dict) and 'universal' in bundle:
            return bundle, 'multi'
        raise ValueError("Format best_models.pkl tidak valid")
    except Exception:
        pass

    try:
        old = joblib.load('trading_model.pkl')
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


# ─── Indicator Calculations ───────────────────────────────────────────────────

def calculate_indicators(df):
    """Hitung semua indikator teknikal + fitur bandarmology dari OHLCV."""
    close  = df['Close'].squeeze()
    high   = df['High'].squeeze()
    low    = df['Low'].squeeze()
    volume = df['Volume'].squeeze()

    # Existing indicators
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

    # New bandarmology features
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


# ─── Bandarmology Fetch ───────────────────────────────────────────────────────

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

        summary     = data.get('summary', {})
        net_foreign = float(summary.get('foreign', {}).get('net_val', 0) or 0)
        net_local   = float(summary.get('local',   {}).get('net_val', 0) or 0)
        net_retail  = float(summary.get('retail',  {}).get('net_val', 0) or 0)
        last_price  = None
        for entry in data.get('history', []):
            if entry.get('data', {}).get('price'):
                last_price = entry['data']['price']

        def map_buyer(b):
            bval = float(b.get('bval') or 0)
            sval = float(b.get('sval') or 0)
            bvol = float(b.get('bvol') or 0)
            return {
                'code':     b.get('code', ''),
                'type':     b.get('type', ''),
                'netVal':   round(bval - sval, 0),
                'avgPrice': round(bval / bvol) if bvol > 0 else 0,
            }

        def map_seller(b):
            bval = float(b.get('bval') or 0)
            sval = float(b.get('sval') or 0)
            svol = float(b.get('svol') or 0)
            return {
                'code':     b.get('code', ''),
                'type':     b.get('type', ''),
                'netVal':   round(sval - bval, 0),
                'avgPrice': round(sval / svol) if svol > 0 else 0,
            }

        buyers  = [map_buyer(b)  for b in data.get('summary', {}).get('top_net_buyers',  [])[:5]]
        sellers = [map_seller(b) for b in data.get('summary', {}).get('top_net_sellers', [])[:5]]

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


# ─── Main Prediction ──────────────────────────────────────────────────────────

def get_prediction(ticker):
    try:
        # 1. Load & pilih model
        models, load_mode = load_models()
        if models is None:
            return {"status": "error", "message": "Tidak ada model tersedia (best_models.pkl / trading_model.pkl)"}

        model_info, model_type = select_model(models, ticker)
        if model_info is None:
            return {"status": "error", "message": f"Tidak ada model untuk {ticker}"}

        svm_model    = model_info['model']
        feature_cols = model_info['features']
        horizon      = model_info.get('horizon', 5)

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
        history_df        = df.tail(60).copy()
        available_features = [f for f in feature_cols if f in history_df.columns]
        X_history         = history_df[available_features].ffill().fillna(0).values

        history_preds = svm_model.predict(X_history)
        history_df    = history_df.iloc[-len(history_preds):].copy()
        history_df['pred'] = history_preds

        # 5. Win rate & recent trades
        wins          = 0
        total_signals = 0
        trade_details = []

        for i in range(len(history_df) - horizon):
            sig = int(history_df['pred'].iloc[i])
            if sig != 0:
                total_signals += 1
                current_price  = float(history_df['Close'].iloc[i])
                future_price   = float(history_df['Close'].iloc[i + horizon])
                date_str       = history_df.index[i].strftime('%d %b')
                is_win         = (sig == 1 and future_price > current_price) or \
                                 (sig == -1 and future_price < current_price)
                if is_win:
                    wins += 1
                profit_pct = (
                    (future_price - current_price) / current_price * 100
                    if sig == 1
                    else (current_price - future_price) / current_price * 100
                )
                trade_details.append({
                    "date":       date_str,
                    "signal":     "BUY" if sig == 1 else "SELL",
                    "price":      current_price,
                    "result":     "WIN" if is_win else "LOSS",
                    "profit_pct": round(profit_pct, 2),
                })

        win_rate      = round(wins / total_signals * 100, 1) if total_signals > 0 else 0
        recent_trades = list(reversed(trade_details[-5:]))

        # 6. Trading plan
        last_price = float(df['Close'].iloc[-1])
        atr_val    = float(df['ATR'].iloc[-1])
        last_pred  = int(history_preds[-1])

        if last_pred == 1:
            plan = {
                "entry":         round(last_price, 0),
                "target_profit": round(last_price + atr_val * 2,    0),
                "stop_loss":     round(last_price - atr_val * 1.5,  0),
                "tp_percent":    round(atr_val * 2    / last_price * 100, 2),
                "sl_percent":    round(-atr_val * 1.5 / last_price * 100, 2),
                "note":          "Kondisi Bullish. Potensi kenaikan terdeteksi.",
            }
        elif last_pred == -1:
            plan = {
                "entry":         round(last_price, 0),
                "target_profit": round(last_price - atr_val * 2,   0),
                "stop_loss":     round(last_price + atr_val * 1.5, 0),
                "tp_percent":    round(-atr_val * 2   / last_price * 100, 2),
                "sl_percent":    round(atr_val * 1.5  / last_price * 100, 2),
                "note":          "Kondisi Bearish. Hindari spekulasi beli.",
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

        # 7. Strength / confidence
        X_last = history_df[available_features].iloc[[-1]].ffill().fillna(0).values
        try:
            proba    = svm_model.predict_proba(X_last)[0]
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
        last   = df.iloc[-1]
        bb_pos = (
            "Overbought" if float(last['Close']) > float(last['BB_UPPER'])
            else "Oversold" if float(last['Close']) < float(last['BB_LOWER'])
            else "Normal"
        )

        def safe(val):
            try:
                return round(float(val), 4) if val is not None and not np.isnan(float(val)) else None
            except Exception:
                return None

        return {
            "status":      "success",
            "ticker":      ticker.upper(),
            "model_type":  model_type,
            "prediction":  "UP" if last_pred == 1 else "DOWN" if last_pred == -1 else "NEUTRAL",
            "strength":    round(strength, 2),
            "win_rate":    win_rate,
            "trading_plan": plan,
            "indicators": {
                "stoch":     safe(last.get('STOCH_%K')),
                "bb_pos":    bb_pos,
                "adx":       safe(last.get('ADX')),
                "obv":       safe(last.get('OBV')),
                "cmf":       safe(last.get('CMF')),
                "mfi":       safe(last.get('MFI')),
                "vol_ratio": safe(last.get('vol_ratio')),
                "close_pos": safe(last.get('close_pos')),
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
