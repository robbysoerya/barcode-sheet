import Dexie from 'dexie';

export const db = new Dexie('BarcodeSheetDB');

db.version(1).stores({
  sheets: 'id, name, created_at',
  columns: 'id, sheet_id, name, type, is_barcode', // type: 'text' | 'number'
  rows: 'id, sheet_id, created_at' // values are stored within the row object but not indexed
});
