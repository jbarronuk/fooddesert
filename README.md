# fooddesert.co.uk

**Is your neighbourhood making you fat?**

An independent tool that scores the food environment around any UK postcode using open government data.

→ [fooddesert.co.uk](https://fooddesert.co.uk)

---

## What it does

Enter a postcode. Get a score. Understand why.

The score is built from three signals:
1. **Outlet composition** — the ratio of takeaways, supermarkets, restaurants, and convenience stores within 800m
2. **Hygiene baseline** — average Food Standards Agency hygiene ratings as a quality proxy
3. **Deprivation context** — ONS Index of Multiple Deprivation overlay

## Data sources

| Source | What it provides | Auth required |
|--------|-----------------|---------------|
| [FSA Hygiene Ratings API](https://api.ratings.food.gov.uk/help) | Every rated food establishment in England | None |
| [Postcodes.io](https://postcodes.io) | Postcode → lat/lng + LSOA | None |
| [ONS IMD 2019](https://www.gov.uk/government/statistics/english-indices-of-deprivation-2019) | Deprivation scores by LSOA | None (CSV download) |

## Project structure

```
fooddesert/
├── src/
│   ├── index.html          # Landing page
│   ├── styles/
│   │   └── main.css
│   ├── scripts/
│   │   └── main.js
│   └── lib/
│       ├── fsa.js          # FSA API client
│       ├── postcodes.js    # Postcodes.io client
│       └── score.js        # Scoring engine
├── public/                 # Static assets (favicons, og images)
├── scripts/                # One-off data processing scripts (Node)
│   └── download-imd.js     # Downloads + processes ONS deprivation CSV
├── docs/
│   └── methodology.md      # Scoring methodology — open to PRs
└── .github/
    └── workflows/
        ├── deploy.yml      # Deploy main → Cloudflare Pages
        └── preview.yml     # PR preview deployments
```

## Running locally

No build step yet — just open `src/index.html` in a browser, or use any static server:

```bash
npx serve src
```

## Deployment

Hosted on Cloudflare Pages. Pushes to `main` deploy automatically via GitHub Actions.

## Methodology

The scoring methodology is documented in [`docs/methodology.md`](docs/methodology.md) and is open to scrutiny and pull requests. If you think the weights are wrong, argue your case and open a PR.

## Licence

Code: MIT  
Data: Open Government Licence v3.0 (FSA), Open Database Licence (Postcodes.io)

Not affiliated with the Food Standards Agency.