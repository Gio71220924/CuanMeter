import sys
import json
import warnings
import joblib
import pandas as pd
import numpy as np
import yfinance as yf

warnings.filterwarnings("ignore")

from ta.volatility import BollingerBands, AverageTrueRange
from ta.momentum import StochasticOscillator
from ta.volume import OnBalanceVolumeIndicator, ChaikinMoneyFlowIndicator, MFIIndicator
from ta.trend import ADXIndicator

TICKERS = [
    'ADRO', 'AKRA', 'BUMI', 'BYAN', 'DEWA', 'DSSA',
    'ENRG', 'GEMS', 'ITMG', 'MEDC', 'PGAS', 'PTBA', 'PTRO', 'RAJA'
]


def load_models():
    try:
        bundle = joblib.load('best_models.pkl')
        if isinstance(bundle, dict) and 'universal' in bundle:
            return bundle
        raise ValueError("Format best_models.pkl tidak valid")
    except Exception:
        pass

    try:
        old = joblib.load('trading_model.pkl')
        return {'universal': {'model': old['model'], 'features': old['features'], 'horizon': 5}}
    except Exception:
        return None


def select_model(models, ticker):
    if ticker.upper() in models:
        return models[ticker.upper()], 'per_emiten'
    if 'universal' in models:
        return models['universal'], 'universal'
    return None, None


def calculate_indicators(df):
    close  = df['Close'].squeeze()
    high   = df['High'].squeeze()
    low    = df['Low'].squeeze()
    volume = df['Volume'].squeeze()

    bb = BollingerBands(close=close, window=20, window_dev=2)
    df['BB_MIDDLE'] = bb.bollinger_mavg()
    df['BB_UPPER']  = bb.bollinger_hband()
    df['BB_LOWER']  = bb.bollinger_lband()

    stoch = StochasticOscillator(high=high, low=low, close=close, window=14, smooth_window=3)
    df['STOCH_%K'] = stoch.stoch()
    df['STOCH_%D'] = stoch.stoch_signal()

    adx = ADXIndicator(high=high, low=low, close=close, window=14)
    df['ADX'] = adx.adx()
    df['ADX_POS'] = adx.adx_pos()
    df['ADX_NEG'] = adx.adx_neg()

    df['OBV'] = OnBalanceVolumeIndicator(close=close, volume=volume).on_balance_volume()

    atr = AverageTrueRange(high=high, low=low, close=close, window=14)
    df['ATR']     = atr.average_true_range()
    df['ATR_pct'] = df['ATR'] / df['Close']

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


def screen_ticker(ticker, df_raw, models):
    try:
        # Extract single-ticker slice dari batch download
        if isinstance(df_raw.columns, pd.MultiIndex):
            cols = ['Open', 'High', 'Low', 'Close', 'Volume']
            ticker_jk = ticker + '.JK'
            # yfinance group_by='ticker' produces (Ticker, Price) level order
            if df_raw.columns.names[0] == 'Ticker':
                df = pd.DataFrame({
                    c: df_raw[(ticker_jk, c)] for c in cols
                    if (ticker_jk, c) in df_raw.columns
                })
            else:
                df = pd.DataFrame({
                    c: df_raw[(c, ticker_jk)] for c in cols
                    if (c, ticker_jk) in df_raw.columns
                })
        else:
            df = df_raw.copy()

        if df.empty or len(df) < 30:
            return {'ticker': ticker, 'status': 'error', 'message': 'Data tidak cukup'}

        for col in ['Open', 'High', 'Low', 'Close', 'Volume']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        df.ffill(inplace=True)
        df.bfill(inplace=True)
        df.dropna(subset=['Close'], inplace=True)

        df = calculate_indicators(df)
        df.dropna(inplace=True)

        if len(df) < 10:
            return {'ticker': ticker, 'status': 'error', 'message': 'Data tidak cukup setelah indikator'}

        model_info, model_type = select_model(models, ticker)
        if model_info is None:
            return {'ticker': ticker, 'status': 'error', 'message': 'Tidak ada model'}

        svm_model    = model_info['model']
        feature_cols = model_info['features']
        horizon      = model_info.get('horizon', 5)

        available = [f for f in feature_cols if f in df.columns]

        # Win rate + last prediction dari 60 hari terakhir
        hist = df.tail(60).copy()
        hist_x = hist[available].ffill().fillna(0).values
        hist_preds = svm_model.predict(hist_x)
        hist = hist.iloc[-len(hist_preds):].copy()
        hist['pred'] = hist_preds

        wins = 0
        total = 0
        for i in range(len(hist) - horizon):
            sig = int(hist['pred'].iloc[i])
            if sig != 0:
                total += 1
                cp = float(hist['Close'].iloc[i])
                fp = float(hist['Close'].iloc[i + horizon])
                if (sig == 1 and fp > cp) or (sig == -1 and fp < cp):
                    wins += 1
        win_rate = round(wins / total * 100, 1) if total > 0 else 0

        last_pred = int(hist_preds[-1])
        last = df.iloc[-1]

        def safe(val):
            try:
                v = float(val)
                return round(v, 4) if not np.isnan(v) else None
            except Exception:
                return None

        X_last = df[available].iloc[[-1]].ffill().fillna(0).values
        try:
            proba = svm_model.predict_proba(X_last)[0]
            strength = round(float(max(proba)), 2)
        except Exception:
            try:
                scores = svm_model.decision_function(X_last)[0]
                strength = round(float(max(abs(scores)) if hasattr(scores, '__len__') else abs(scores)), 2)
            except Exception:
                strength = 0.0

        return {
            'ticker':     ticker,
            'status':     'success',
            'prediction': 'UP' if last_pred == 1 else 'DOWN' if last_pred == -1 else 'NEUTRAL',
            'strength':   strength,
            'win_rate':   win_rate,
            'model_type': model_type,
            'price':      safe(last.get('Close')),
            'indicators': {
                'stoch': safe(last.get('STOCH_%K')),
                'cmf':   safe(last.get('CMF')),
                'adx':   safe(last.get('ADX')),
            },
        }

    except Exception as e:
        return {'ticker': ticker, 'status': 'error', 'message': str(e)}


def run_screener():
    models = load_models()
    if models is None:
        print(json.dumps({'status': 'error', 'message': 'best_models.pkl tidak ditemukan'}))
        return

    tickers_jk = [t + '.JK' for t in TICKERS]
    try:
        df_all = yf.download(
            tickers_jk, period='100d', interval='1d',
            progress=False, auto_adjust=False, group_by='ticker'
        )
    except Exception as e:
        print(json.dumps({'status': 'error', 'message': f'Download gagal: {e}'}))
        return

    results = [screen_ticker(t, df_all, models) for t in TICKERS]
    print(json.dumps(results))


if __name__ == '__main__':
    run_screener()
