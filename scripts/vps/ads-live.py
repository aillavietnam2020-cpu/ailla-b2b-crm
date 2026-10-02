#!/usr/bin/env python3
"""Đọc file BÁO CÁO DIGITAL MKT 2026 FINAL (3 tab Ads Việt Anh / Thảo / Duẩn) rồi đẩy lên Trang quản trị Ailla.
Chạy bằng cron 5 phút/lần. Không dùng AI, không tốn token. Khoá đẩy lên web: /root/.config/ailla/ingest.key."""
import json, subprocess, sys, urllib.request

SHEET = "1LEMLE7GQ1ZeC03mHq0AW7ggacmXYd8gnSubU3v0KxLY"
TABS = {"Việt Anh": "Ads Việt Anh", "Thảo": "Ads Thảo", "Duẩn": "Ads Duẩn"}
URL = "https://ailla-b2b-crm.aillavietnam2020.workers.dev/api/ingest/ads-live"

def read(tab):
    out = subprocess.run(["aduca-google", "sheets", "get", SHEET, f"{tab}!A1:AI500", "--json"],
                         capture_output=True, text=True, timeout=120)
    if out.returncode != 0:
        raise RuntimeError(f"đọc {tab} lỗi: {out.stderr.strip()[-300:]}")
    return json.loads(out.stdout).get("values", [])

def main():
    key = open("/root/.config/ailla/ingest.key").read().strip()
    tabs = {name: read(tab) for name, tab in TABS.items()}
    req = urllib.request.Request(URL, data=json.dumps({"tabs": tabs}, ensure_ascii=False).encode(),
                                 headers={"Content-Type": "application/json", "X-Ingest-Key": key, "User-Agent": "ailla-ads-live/1.0"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        print(r.status, r.read().decode()[:200])

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("LỖI:", e, file=sys.stderr)
        sys.exit(1)
