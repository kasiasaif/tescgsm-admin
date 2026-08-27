import { closeDb, exportProductsJson } from './db.ts'

await exportProductsJson()
await closeDb()
console.log('Wrote products.json')
