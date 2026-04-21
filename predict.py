import sys
import json
import joblib
import pandas as pd
import yfinance as yf
import warnings

# Menghilangkan peringatan versi agar output JSON bersih
warnings.filterwarnings("ignore", category=UserWarning)

from ta.volatility import BollingerBands
from ta.momentum import StochasticOscillator
from ta.volume import OnBalanceVolumeIndicator
from ta.trend import ADXIndicator

def get_prediction(ticker):
    try:
        # 1. Load model
        bundle = joblib.load('trading_model.pkl')
        model = bundle['model']
        features = bundle['features']

        # 2. Ambil data
        formatted_ticker = f"{ticker}.JK" if ".JK" not in ticker.upper() else ticker
        df = yf.download(formatted_ticker, period="60d", interval="1d", progress=False, auto_adjust=True)

        if df.empty or len(df) < 20:
            return {"status": "error", "message": f"Data {ticker} tidak ditemukan."}

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Data Series
        close_data = df['Close'].squeeze()
        high_data = df['High'].squeeze()
        low_data = df['Low'].squeeze()
        vol_data = df['Volume'].squeeze()

        # 3. Hitung Indikator
        # BB & Stoch
        bb = BollingerBands(close=close_data, window=20, window_dev=2)
        df['BB_MIDDLE'] = bb.bollinger_mavg()
        df['BB_UPPER'] = bb.bollinger_hband()
        df['BB_LOWER'] = bb.bollinger_lband()

        stoch = StochasticOscillator(high=high_data, low=low_data, close=close_data, window=14)
        df['STOCH_%K'] = stoch.stoch()
        df['STOCH_%D'] = stoch.stoch_signal()

        # ADX
        adx_ind = ADXIndicator(high=high_data, low=low_data, close=close_data, window=14)
        df['ADX'] = adx_ind.adx()

        # OBV
        obv_ind = OnBalanceVolumeIndicator(close=close_data, volume=vol_data)
        df['OBV'] = obv_ind.on_balance_volume()

        # 4. Prediksi
        last_row = df[features].tail(1)


        if last_row.isnull().values.any():
            return {
                "status": "error",
                "message": "Indikator belum lengkap."
            }

        prediction = model.predict(last_row)[0]

        # Tambahan: Ambil skor keyakinan (Decision Function)
        # Semakin jauh dari 0, semakin kuat sinyalnya
        try:
            scores = model.decision_function(last_row)[0]
            # Ambil nilai absolut terbesar sebagai indikasi kekuatan
            strength = float(max(abs(scores)) if hasattr(scores, "__len__") else abs(scores))
        except:
            strength = 0

        # Mapping hasil
        signal = "UP" if prediction == 1 else "DOWN" if prediction == -1 else "NEUTRAL"

        return {
            "status": "success",
            "ticker": ticker.upper(),
            "last_price": round(float(close_data.iloc[-1]), 2),
            "prediction": signal,
            "strength": round(strength, 2),
            "details": {
                "stoch": round(float(df['STOCH_%K'].iloc[-1]), 2),
                "bb_pos": "Overbought" if close_data.iloc[-1] > df['BB_UPPER'].iloc[-1] else "Oversold" if close_data.iloc[-1] < df['BB_LOWER'].iloc[-1] else "Normal",
                "adx": round(float(df['ADX'].iloc[-1]), 2),
                "obv": round(float(df['OBV'].iloc[-1]), 0)
            }
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


if __name__ == "__main__":
    ticker_input = sys.argv[1] if len(sys.argv) > 1 else "BBCA"
    print(json.dumps(get_prediction(ticker_input)))