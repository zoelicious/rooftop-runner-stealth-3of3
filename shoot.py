import json, sys, time
from playwright.sync_api import sync_playwright
base = sys.argv[1]  # repo dir
shots = [
    {"query": "?shot=1", "name": "1-cover.jpg"},
    {"query": "?shot=2", "name": "2-patrol.jpg"},
    {"query": "?shot=3", "name": "3-pebble.jpg"},
    {"query": "?shot=4", "name": "4-victory.jpg"},
]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    for s in shots:
        pg.goto(f"http://127.0.0.1:8131/index.html{s['query']}")
        pg.wait_for_timeout(1200)
        pg.screenshot(path=f"{base}/screenshots/{s['name']}", type="jpeg", quality=82)
        print("shot", s["name"])
    b.close()
