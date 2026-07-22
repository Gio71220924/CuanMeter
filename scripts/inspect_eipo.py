#!/usr/bin/env python3
"""Debug: check what e-ipo.co.id returns and whether parser will work."""
import re
import sys

URL = "https://e-ipo.co.id/id/home"
HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
}

try:
    from curl_cffi import requests as creq
    r = creq.get(URL, headers=HEADERS, impersonate="chrome", timeout=25)
    html = r.text
    print(f"STATUS: {r.status_code}")
    print(f"LENGTH: {len(html)} chars")
    print(f"HAS ipo-list: {'ipo-list' in html}")
    print(f"HAS data-key: {'data-key' in html}")
    keys = re.findall(r'data-key="(\d+)"', html)
    print(f"data-key count: {len(keys)} -> {keys[:5]}")
    idx = html.find('id="ipo-list"')
    if idx >= 0:
        print("\nSekitar #ipo-list:")
        print(html[idx:idx+500])
    else:
        print("\nTIDAK ADA #ipo-list, first 800 chars:")
        print(html[:800])
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
