# Trident Lead Cards (phone app)

An installable home-screen app for the Lead Cards page. This repo is public and holds **no lead data**: only the app shell.
Your leads stay in the private `lead-finder` repo (`results/`). The app reads them with a read-only GitHub token you paste once; the token is kept only on your phone.

## Publish it (once)
1. GitHub, New repository, name `trident-lead-app`, **Public**, add these files (upload the folder contents).
2. Settings, Pages, Deploy from a branch, `main`, `/ (root)`, Save.
3. Your app is at `https://slaphead123.github.io/trident-lead-app/`.

## Install on your phone (once)
1. Open the link above in Safari (iPhone) or Chrome (Android).
2. Make a fine-grained token: only repository `lead-finder`, **Contents: Read-only**. Paste it in the box and tap Save.
3. iPhone: Share, Add to Home Screen. Android: menu, Install app.

## How it works
- `sw.js` serves `/data/*` by fetching `results/*` from the private repo with your token, caching copies so it works offline.
- `shim.js` replaces the Claude page runtime so sent/won ticks, replies and notes are saved on the phone.
- New cards appear each Monday after the pipeline commits `results/`. Pull down to reload.
- Token expired? Open the app link with `?reset` on the end and paste a new one.
- Sent/won ticks live on that phone only; a second device starts empty.

## Add a logo and photos (per lead card)
Every lead card has **Add logo + photos**. Tap it, choose the logo and photos together (the app guesses which picture is the logo; tap one to change it), tick the rights box and Upload. Files are shrunk on the phone and saved to `uploads/<business>/` in the private lead-finder repo using the app's own key, which therefore needs **Contents: Read and write** (make a new fine-grained token for lead-finder only, open the app with `?reset`, paste it). A push to `uploads/` runs the "Refresh designs from phone uploads" workflow, which rebuilds only that design and updates its card image. Pull down to reload after a few minutes. No other keys, repos or buttons.
