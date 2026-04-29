# Crocker Grocery List

Family grocery list PWA for Chad, Ashley, and Clayton.

- **Live URL:** https://grocery.cacattlebrd.com
- **Backend:** Google Sheet (`Crocker Grocery List`) in Chad's Drive
- **Glue:** Google Apps Script web app
- **Frontend:** This repo, served via GitHub Pages

## Files

| File | What it does |
|---|---|
| `index.html` | App shell — name picker, list, history, add modal |
| `app.js` | All client logic, fetch calls to Apps Script webhook |
| `style.css` | Mobile-first styling |
| `manifest.json` | PWA manifest (install-to-home-screen support) |
| `sw.js` | Service worker — caches shell for offline read |
| `icon-192.png` / `icon-512.png` | PWA icons |
| `CNAME` | Custom domain for GitHub Pages |

## Stores (tab order)

HEB → Sam's Club → Tractor Supply → Walmart → Petco

## Family

Chad / Ashley / Clayton (name picker on first visit, stored in localStorage)

## Apps Script webhook

Endpoints:

- `GET ?action=list` → active items, grouped by store
- `GET ?action=history` → bought items, last 90 days
- `POST {action:"add", store, item, quantity, notes, addedBy}`
- `POST {action:"mark_bought", id, boughtBy}`
- `POST {action:"readd", id, addedBy}`

Webhook URL is hardcoded in `app.js`. To rotate it, redeploy in Apps Script and update the `WEBHOOK_URL` constant.

## Hosting

- DNS: Namecheap → Cloudflare → GitHub Pages
- Cloudflare CNAME: `grocery` → `cacattlebrd.github.io` (proxy OFF for SSL)
- GitHub Pages: enabled on `main` branch root, custom domain `grocery.cacattlebrd.com`, enforce HTTPS

## Constitution notes

- Rule #6: web app deployed as "Anyone with the link" (the only way Apps Script POSTs work cross-origin without OAuth). URL is unguessable but not secret.
- All data lives in Chad's Drive + this GitHub repo. No third-party services beyond Google + Cloudflare + GitHub.
