# Taste file maker

Five prompts in, a `taste.md` out, in about six minutes. Built for the "Prototype with AI" workshop.

- Plain HTML, CSS and JS. No build step, no framework, no dependencies.
- Everything runs in the browser tab. No model call, no keys, no analytics, nothing stored on a server. Answers sit in `sessionStorage` so a reload does not lose them; closing the tab clears them.
- Rules are derived from each "why" by a few string rules in `app.js` (`deriveRule`). The participant can edit every rule before download.
- Fonts: Fraunces and Instrument Sans from Google Fonts. That is the only outside request the page makes.

## Run locally

Any static server works. For example:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Deploy

Hosted on Webflow Cloud as a static app (`webflow.json` pins `"framework": "static"`). All asset paths are relative, so the app works at any mount path. Connect this GitHub repo in the Webflow Cloud dashboard and pick the branch; pushes to that branch deploy.
