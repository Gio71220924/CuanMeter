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


def get_prediction(ticker):
    try:
        # 1. Load model
        bundle = joblib.load('trading_model.pkl')
        model = bundle['model']
        features = bundle['features']

        # 2. Ambil data
        formatted_ticker = f"{ticker}.JK" if ".JK" not in ticker.upper() else ticker
        df = yf.download(
            formatted_ticker,
            period="60d",
            interval="1d",
            progress=False,
            auto_adjust=True
        )

        if df.empty or len(df) < 20:
            return {
                "status": "error",
                "message": f"Data {ticker} tidak ditemukan."
            }

        # Perbaikan: meratakan kolom Multi-Index yfinance
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Pastikan data adalah Series 1D
        close_data = df['Close'].squeeze()
        high_data = df['High'].squeeze()
        low_data = df['Low'].squeeze()

        # 3. Hitung indikator
        bb = BollingerBands(close=close_data, window=20, window_dev=2)
        df['BB_MIDDLE'] = bb.bollinger_mavg()
        df['BB_UPPER'] = bb.bollinger_hband()
        df['BB_LOWER'] = bb.bollinger_lband()

        stoch = StochasticOscillator(
            high=high_data,
            low=low_data,
            close=close_data,
            window=14,
            smooth_window=3
        )
        df['STOCH_%K'] = stoch.stoch()
        df['STOCH_%D'] = stoch.stoch_signal()

        # 4. Ambil baris terakhir
        last_row = df[features].tail(1)

        if last_row.isnull().values.any():
            return {
                "status": "error",
                "message": "Indikator belum lengkap."
            }

        prediction = model.predict(last_row)[0]

        return {
            "status": "success",
            "ticker": ticker.upper(),
            "last_price": round(float(close_data.iloc[-1]), 2),
            "prediction": "UP" if prediction == 1 else "DOWN" if prediction == -1 else "NEUTRAL"
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


if __name__ == "__main__":
    ticker_input = sys.argv[1] if len(sys.argv) > 1 else "BBCA"
    print(json.dumps(get_prediction(ticker_input)))