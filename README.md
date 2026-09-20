# tescgsm admin

Admin CRM for the [tescgsm](https://tescgsm.es) shop. This is an example of how a public website can be managed from a separate app: products, categories, staff roles, and **custom banners** for the homepage.

**Admin:** [tescgsm-admin.es](https://tescgsm-admin.es)  
**Shop:** [tescgsm.es](https://tescgsm.es) · [source](https://github.com/kasiasaif/new-project)

GitHub Pages cannot run this app. It needs Node and a database (Postgres on Render, or local MySQL).

## How it connects to the shop

Staff sign in here and maintain the catalog. The shop at tescgsm.es is the public storefront that displays that catalog and the active banners.

Typical flow:

1. Add or hide a part, category, or homepage banner in this CRM
2. The shop reads that catalog/banner data
3. Customers see the update on tescgsm.es

Banners are not hardcoded in the shop layout. Each banner has a title, body, image, button label, and link, plus Active/Disable.

## Explore as a visitor

A read-only demo account is available so anyone can look around without changing live data:

- **Username:** `visitor`
- **Password:** `welcome`

Open [tescgsm-admin.es](https://tescgsm-admin.es), sign in, and browse. Visitor cannot save products, banners, or account edits.

Admin and staff passwords are **not** stored in git. They live in a local `.env` file and in the Render dashboard.

## Secrets

Never commit `.env`, `DATABASE_URL`, MySQL passwords, private keys, or PEM files. `.gitignore` blocks them. Use `.env.example` as a blank template. On Render, set database and admin values in **Environment**, not in this repo.

## Branches

- **staging** — local work (`npm run dev` → http://localhost:5174)
- **production** — live site; Render deploys only from this branch

```bash
git checkout production
git merge staging
git push
```

## Local

```bash
git checkout staging
npm install
cp .env.example .env
npm run dev
```

Fill `.env` on your machine only. Open http://localhost:5174.
