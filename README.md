# tescgsm admin

Admin CRM for the [tescgsm](https://tescgsm.es) shop. This is an example of how a public website can be managed from a separate app: products, categories, staff roles, and **custom banners** for the homepage.

**Admin:** [tescgsm-admin.onrender.com](https://tescgsm-admin.onrender.com)  
**Shop:** [tescgsm.es](https://tescgsm.es) · [source](https://github.com/kasiasaif/mobile-shop)

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

Open [tescgsm-admin.onrender.com](https://tescgsm-admin.onrender.com), sign in, and browse. Visitor cannot save products, banners, or account edits.




