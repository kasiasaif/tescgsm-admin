# tescgsm admin

Admin CRM for the tescgsm shop.

- Shop: **https://tescgsm.es**
- Admin: **https://admin-tescgsm.es**

GitHub Pages cannot run this app. It needs Node and MySQL.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:5174 and sign in with `admin` / `tescgsm`.

## Live on admin-tescgsm.es

1. Create a free web service on [Render](https://render.com) from this GitHub repo.
2. Create a MySQL database on the same account and paste the connection values into the service env vars.
3. In your domain DNS, add:

| Type | Name | Value |
|---|---|---|
| CNAME | `@` or `admin-tescgsm.es` | `YOUR-SERVICE.onrender.com` |

If the panel does not allow CNAME on `@`, use the CNAME target Render shows after you add the custom domain there.
