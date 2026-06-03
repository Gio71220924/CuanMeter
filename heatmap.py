import json
import os
import warnings
from datetime import datetime, timezone, timedelta

warnings.filterwarnings("ignore")

import pandas as pd
import yfinance as yf

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, 'data')
SECTORS_FILE = os.path.join(DATA_DIR, 'sectors.json')
SHARES_FILE = os.path.join(DATA_DIR, 'heatmap-shares.json')
SHARES_TTL_HOURS = 24


def load_sectors():
    with open(SECTORS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def all_tickers(sectors):
    out = []
    for s in sectors:
        out.extend(s['tickers'])
    return out


def load_shares_cache():
    """Return (shares_dict, stale_bool)."""
    if not os.path.exists(SHARES_FILE):
        return {}, True
    try:
        with open(SHARES_FILE, 'r', encoding='utf-8') as f:
            cache = json.load(f)
        gen = datetime.fromisoformat(cache.get('generated_at', '').replace('Z', '+00:00'))
        stale = datetime.now(timezone.utc) - gen > timedelta(hours=SHARES_TTL_HOURS)
        return cache.get('shares', {}), stale
    except Exception:
        return {}, True


def refresh_shares(tickers, existing):
    """Fetch shares outstanding per ticker via yfinance fast_info. Keep old value on failure."""
    shares = dict(existing)
    for t in tickers:
        try:
            fi = yf.Ticker(t + '.JK').fast_info
            s = fi.shares
            if s and s > 0:
                shares[t] = int(s)
        except Exception:
            pass  # keep existing value if any
    return shares


def save_shares_cache(shares):
    payload = {'generated_at': datetime.now(timezone.utc).isoformat(), 'shares': shares}
    with open(SHARES_FILE, 'w', encoding='utf-8') as f:
        json.dump(payload, f)


def get_shares(tickers):
    cached, stale = load_shares_cache()
    missing = [t for t in tickers if t not in cached]
    if stale or missing:
        cached = refresh_shares(tickers, cached)
        save_shares_cache(cached)
    return cached


def fetch_prices(tickers):
    """Return {ticker: (last_close, pct_change)} via one batch download."""
    jk = [t + '.JK' for t in tickers]
    df = yf.download(
        jk, period='5d', interval='1d',
        progress=False, auto_adjust=False, group_by='ticker'
    )
    out = {}
    for t in tickers:
        try:
            sub = df[t + '.JK'] if isinstance(df.columns, pd.MultiIndex) else df
            closes = sub['Close'].dropna()
            if len(closes) >= 2:
                last = float(closes.iloc[-1])
                prev = float(closes.iloc[-2])
                if prev > 0:
                    out[t] = (last, (last / prev - 1) * 100)
        except Exception:
            pass
    return out


def build_heatmap():
    sectors = load_sectors()
    tickers = all_tickers(sectors)
    shares = get_shares(tickers)
    prices = fetch_prices(tickers)

    result_sectors = []
    for s in sectors:
        stocks = []
        for t in s['tickers']:
            if t not in prices or t not in shares:
                continue
            price, pct = prices[t]
            stocks.append({
                'ticker': t,
                'price': round(price, 2),
                'pct': round(pct, 2),
                'mcap': round(shares[t] * price),
            })
        if stocks:
            result_sectors.append({'name': s['name'], 'code': s['code'], 'stocks': stocks})

    shown = sum(len(s['stocks']) for s in result_sectors)

    return {
        'status': 'ok',
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'total': len(tickers),
        'shown': shown,
        'sectors': result_sectors,
    }


if __name__ == '__main__':
    try:
        print(json.dumps(build_heatmap()))
    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}))
