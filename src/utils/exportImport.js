import Papa from 'papaparse';
import { db } from '../db';

export const exportToCSV = async (sheetId, sheetName) => {
  const columns = await db.columns.where({ sheet_id: sheetId }).toArray();
  const rows = await db.rows.where({ sheet_id: sheetId }).toArray();

  const data = rows.map(row => {
    const rowData = {};
    columns.forEach(col => {
      rowData[col.name] = row.values[col.id] || '';
    });
    return rowData;
  });

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${sheetName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const importFromCSV = (file, sheetId, onComplete) => {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      const data = results.data;
      if (data.length === 0) return onComplete(false, 'File is empty');

      const headers = Object.keys(data[0]);
      
      // Get existing columns
      let columns = await db.columns.where({ sheet_id: sheetId }).toArray();
      const colMap = {};
      
      // Auto-match headers to columns or create new ones
      for (const header of headers) {
        let col = columns.find(c => c.name.toLowerCase() === header.toLowerCase());
        if (!col) {
          col = {
            id: crypto.randomUUID(),
            sheet_id: sheetId,
            name: header,
            type: 'text',
            is_barcode: false
          };
          await db.columns.add(col);
          columns.push(col); // Update local reference
        }
        colMap[header] = col.id;
      }

      // Add rows
      const newRows = data.map(row => {
        const values = {};
        Object.entries(row).forEach(([key, value]) => {
          if (colMap[key]) {
            values[colMap[key]] = value;
          }
        });
        return {
          id: crypto.randomUUID(),
          sheet_id: sheetId,
          values,
          created_at: new Date().toISOString()
        };
      });

      await db.rows.bulkAdd(newRows);
      onComplete(true, `Successfully imported ${newRows.length} rows`);
    },
    error: (error) => {
      onComplete(false, error.message);
    }
  });
};
