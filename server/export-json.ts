import { closeDb, exportBannersJson, exportCategoriesJson, exportProductsJson } from './db.ts'

await exportProductsJson()
await exportBannersJson()
await exportCategoriesJson()
await closeDb()
console.log('Wrote products.json, banners.json, and categories.json')
