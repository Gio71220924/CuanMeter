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


def recompute_pbv(tk, info):
    """PBV = market cap / total equity. Yahoo's priceToBook uses a per-share book
    value that goes haywire around stock splits (e.g. DSSA showing 68333x); total
    equity from the balance sheet is split-invariant. Fall back to a sanity-capped
    priceToBook if the balance sheet is unavailable."""
    mc = info.get('marketCap')
    if isinstance(mc, (int, float)) and mc > 0:
        try:
            bs = tk.balance_sheet
            for key in ('Stockholders Equity', 'Total Stockholder Equity', 'Common Stock Equity'):
                if key in bs.index:
                    eq = bs.loc[key].dropna()
                    if len(eq) and float(eq.iloc[0]) > 0:
                        val = round(mc / float(eq.iloc[0]), 2)
                        # split can corrupt marketCap too (DSSA); only trust a sane ratio
                        if 0 < val < 1000:
                            return val
        except Exception:
            pass
    ptb = info.get('priceToBook')
    return round(ptb, 2) if isinstance(ptb, (int, float)) and 0 < ptb < 1000 else None


def fetch(ticker):
    tk = yf.Ticker(ticker + '.JK')
    info = tk.info or {}
    return {
        'name': info.get('longName') or info.get('shortName'),
        'sector': info.get('sector'),
        'industry': info.get('industry'),
        'marketCap': info.get('marketCap'),
        'per': num(info.get('trailingPE')),
        'forwardPer': num(info.get('forwardPE')),
        'pbv': recompute_pbv(tk, info),
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
