#!/usr/bin/env python3
"""Fetch e-ipo.co.id home page HTML, bypassing Cloudflare.

curl/Node fetch get blocked (403 "Just a moment") from datacenter IPs because
of TLS fingerprinting. curl_cffi impersonates a real Chrome TLS fingerprint,
which gets past Cloudflare's JA3 check. Prints the HTML to stdout for
server.js (/ipo-news) to parse.
"""
import sys

URL = "https://e-ipo.co.id/id/home"
HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
}


def main():
    # Primary: curl_cffi with Chrome impersonation (best Cloudflare bypass).
    try:
        from curl_cffi import requests as creq
        r = creq.get(URL, headers=HEADERS, impersonate="chrome", timeout=25)
        sys.stdout.write(r.text)
        return
    except Exception as e:
        sys.stderr.write(f"curl_cffi failed: {e}\n")

    # Fallback: plain requests with a browser User-Agent.
    try:
        import requests
        h = dict(HEADERS)
        h["User-Agent"] = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        )
        r = requests.get(URL, headers=h, timeout=25)
        sys.stdout.write(r.text)
        return
    except Exception as e:
        sys.stderr.write(f"requests failed: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
