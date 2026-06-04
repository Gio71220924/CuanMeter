"""fundamentals.py — key fundamentals for an IDX stock via yfinance .info.

Usage:  python fundamentals.py BBRI
Output: {"status":"ok","ticker":"BBRI","data":{...}}

.info is slow & rate-prone, so the server caches the result for 24h per ticker.
"""
import sys
import json

import yfinance as yf


def pct(v):
    """Fraction (0..1) -> percent, rounded."""
    return round(v * 100, 2) if isinstance(v, (int, float)) else None


def num(v, d=2):
    return round(v, d) if isinstance(v, (int, float)) else None


def div_yield(info):
    """Dividend yield (%). yfinance data IDX tidak konsisten:
    - 'trailingAnnualDividendYield' (rasio) akurat tapi sering 0/kosong;
    - 'dividendYield' (persen) ada di semua tapi kadang ketinggian (yield indikatif).
    Pakai trailing kalau valid, kalau tidak fallback ke dividendYield."""
    tady = info.get('trailingAnnualDividendYield')
    if isinstance(tady, (int, float)) and tady > 0:
        return round(tady * 100, 2)
    dy = info.get('dividendYield')
    return round(dy, 2) if isinstance(dy, (int, float)) and dy > 0 else None


def fetch(ticker):
    info = yf.Ticker(ticker + '.JK').info or {}
    return {
        'name': info.get('longName') or info.get('shortName'),
        'sector': info.get('sector'),
        'industry': info.get('industry'),
        'marketCap': info.get('marketCap'),
        'per': num(info.get('trailingPE')),
        'forwardPer': num(info.get('forwardPE')),
        'pbv': num(info.get('priceToBook')),
        'roe': pct(info.get('returnOnEquity')),
        'eps': num(info.get('trailingEps')),
        'divYield': div_yield(info),
        'profitMargin': pct(info.get('profitMargins')),
        'der': num(info.get('debtToEquity')),
        'beta': num(info.get('beta')),
        'high52': num(info.get('fiftyTwoWeekHigh')),
        'low52': num(info.get('fiftyTwoWeekLow')),
    }


if __name__ == '__main__':
    t = (sys.argv[1] if len(sys.argv) > 1 else '').upper().strip()
    try:
        if not t:
            raise ValueError('ticker required')
        print(json.dumps({'status': 'ok', 'ticker': t, 'data': fetch(t)}))
    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}))
