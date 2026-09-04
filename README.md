# tescgsm admin

Admin CRM for the tescgsm shop.

- Shop: **https://tescgsm.es**
- Admin: **https://tescgsm-admin.es**

GitHub Pages cannot run this app. It needs Node and Postgres.

## Branches

- **staging** — work here. Run locally with `npm run dev` → http://localhost:5174
- **production** — live site on tescgsm-admin.es. Render deploys only from this branch.

To publish:

```bash
git checkout production
git merge staging
git push
```

## Local (staging)

```bash
git checkout staging
npm install
npm run dev
```

Open http://localhost:5174 and sign in with `admin` / `tescgsm`.

## Live on tescgsm-admin.es

1. Create a free web service on [Render](https://render.com) from this GitHub repo.
2. Set the deploy branch to **production**.
3. Create a Postgres database on the same account and set `DATABASE_URL`.
4. On tescgsm-admin.es DNS, point `@` at `YOUR-SERVICE.onrender.com`.
