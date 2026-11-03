import { closeDb, exportBannersJson, exportBrandsJson, exportCategoriesJson, exportHeaderBannersJson, exportProductsJson } from './db.ts'

await exportProductsJson()
await exportBannersJson()
await exportHeaderBannersJson()
await exportBrandsJson()
await exportCategoriesJson()
await closeDb()
console.log('Wrote products.json, banners.json, header-banners.json, brands.json, and categories.json')
