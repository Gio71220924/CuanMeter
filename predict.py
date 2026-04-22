import sys
import json
import joblib
import pandas as pd
import yfinance as yf
import warnings

# Menghilangkan peringatan versi agar output JSON bersih
warnings.filterwarnings("ignore", category=UserWarning)

from ta.volatility import BollingerBands, AverageTrueRange
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
        df = yf.download(formatted_ticker, period="100d", interval="1d", progress=False, auto_adjust=True)

        if df.empty or len(df) < 30:
            return {"status": "error", "message": f"Data {ticker} tidak cukup."}

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        close_data = df['Close'].squeeze()
        high_data = df['High'].squeeze()
        low_data = df['Low'].squeeze()
        vol_data = df['Volume'].squeeze()

        # 3. Hitung Indikator
        bb = BollingerBands(close=close_data, window=20)
        df['BB_MIDDLE'] = bb.bollinger_mavg()
        df['BB_UPPER'] = bb.bollinger_hband()
        df['BB_LOWER'] = bb.bollinger_lband()
        df['STOCH_%K'] = StochasticOscillator(high=high_data, low=low_data, close=close_data).stoch()
        df['STOCH_%D'] = StochasticOscillator(high=high_data, low=low_data, close=close_data).stoch_signal()
        df['ADX'] = ADXIndicator(high=high_data, low=low_data, close=close_data).adx()
        df['OBV'] = OnBalanceVolumeIndicator(close=close_data, volume=vol_data).on_balance_volume()
        
        # Tambahan untuk Trading Plan
        atr_ind = AverageTrueRange(high=high_data, low=low_data, close=close_data, window=14)
        df['ATR'] = atr_ind.average_true_range()

        # 4. Backtest Sederhana (Cek akurasi 60 hari terakhir)
        history_df = df.tail(60).copy()
        X_history = history_df[features].ffill().fillna(0)
        history_predictions = model.predict(X_history)
        history_df['pred'] = history_predictions
        
        # Hitung Win Rate & Catat Detail Trade
        wins = 0
        total_signals = 0
        trade_details = []
        
        # Kita scan dari belakang untuk ambil history terbaru
        for i in range(len(history_df) - 5):
            sig = int(history_df['pred'].iloc[i])
            if sig != 0:
                total_signals += 1
                current_price = float(history_df['Close'].iloc[i])
                future_price = float(history_df['Close'].iloc[i+3])
                date_str = history_df.index[i].strftime('%d %b')
                
                is_win = (sig == 1 and future_price > current_price) or (sig == -1 and future_price < current_price)
                if is_win: wins += 1
                
                # Simpan 5 sinyal terakhir saja untuk detail
                trade_details.append({
                    "date": date_str,
                    "signal": "BUY" if sig == 1 else "SELL",
                    "price": current_price,
                    "result": "WIN" if is_win else "LOSS",
                    "profit_pct": round(((future_price - current_price) / current_price * 100) if sig == 1 else ((current_price - future_price) / current_price * 100), 2)
                })
        
        win_rate = (wins / total_signals * 100) if total_signals > 0 else 0
        # Ambil 5 sinyal paling baru dari daftar
        recent_trades = trade_details[-5:] if len(trade_details) > 5 else trade_details
        recent_trades.reverse() # Terbaru di atas

        # 5. Trading Plan (Berdasarkan baris terakhir)
        last_price = float(close_data.iloc[-1])
        atr_val = float(df['ATR'].iloc[-1])
        last_pred = int(history_predictions[-1])
        
        # Inisialisasi Plan
        plan = {
            "entry": round(last_price, 0),
            "target_profit": 0,
            "stop_loss": 0,
            "note": "Tunggu sinyal konfirmasi"
        }

        if last_pred == 1: # Sinyal NAIK
            plan["target_profit"] = round(last_price + (atr_val * 2), 0)
            plan["stop_loss"] = round(last_price - (atr_val * 1.5), 0)
            plan["note"] = "Kondisi Bullish. Potensi kenaikan terdeteksi."
        elif last_pred == -1: # Sinyal TURUN
            plan["target_profit"] = round(last_price - (atr_val * 2), 0)
            plan["stop_loss"] = round(last_price + (atr_val * 1.5), 0)
            plan["note"] = "Kondisi Bearish. Hindari spekulasi beli."
        else:
            plan["note"] = "Sideways. Harga bergerak di rentang sempit."

        # Hitung Persentase
        if plan["target_profit"] > 0:
            plan["tp_percent"] = round(((plan["target_profit"] - last_price) / last_price) * 100, 2)
            plan["sl_percent"] = round(((plan["stop_loss"] - last_price) / last_price) * 100, 2)
        else:
            plan["tp_percent"] = 0
            plan["sl_percent"] = 0

        # Ambil skor keyakinan (Strength) - PENTING agar tidak undefined
        try:
            scores = model.decision_function(X_history.tail(1))[0]
            strength = float(max(abs(scores)) if hasattr(scores, "__len__") else abs(scores))
        except:
            strength = 0

        # Siapkan data untuk chart
        chart_data = []
        for index, row in history_df.iterrows():
            chart_data.append({
                "time": index.strftime('%Y-%m-%d'),
                "open": float(row['Open']), "high": float(row['High']),
                "low": float(row['Low']), "close": float(row['Close']),
                "signal": int(row['pred'])
            })

        return {
            "status": "success",
            "ticker": ticker.upper(),
            "prediction": "UP" if last_pred == 1 else "DOWN" if last_pred == -1 else "NEUTRAL",
            "strength": round(strength, 2),
            "win_rate": round(win_rate, 1),
            "recent_trades": recent_trades,
            "chart_history": chart_data,
            "trading_plan": plan,
            "details": {
                "stoch": round(float(df['STOCH_%K'].iloc[-1]), 2),
                "bb_pos": "Overbought" if last_price > df['BB_UPPER'].iloc[-1] else "Oversold" if last_price < df['BB_LOWER'].iloc[-1] else "Normal",
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