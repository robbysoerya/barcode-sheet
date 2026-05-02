import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Download, Upload, Scan, Trash2, Edit2 } from 'lucide-react';
import { db } from '../db';
import ScannerModal from '../components/ScannerModal';
import { exportToCSV, importFromCSV } from '../utils/exportImport';

export default function SheetDetail() {
  const { sheetId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const sheet = useLiveQuery(() => db.sheets.get(sheetId), [sheetId]);
  const columns = useLiveQuery(() => db.columns.where({ sheet_id: sheetId }).toArray(), [sheetId]) || [];
  const rows = useLiveQuery(() => db.rows.where({ sheet_id: sheetId }).reverse().sortBy('created_at'), [sheetId]) || [];

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [isRowModalOpen, setIsRowModalOpen] = useState(false);
  const [newColumnData, setNewColumnData] = useState({ name: '', type: 'text', is_barcode: false });
  const [newRowData, setNewRowData] = useState({});

  if (!sheet) return <div className="app-container"><p>Loading...</p></div>;

  const handleScan = async (text) => {
    setIsScannerOpen(false);
    const barcodeCol = columns.find(c => c.is_barcode);
    if (barcodeCol) {
      setNewRowData(prev => ({ ...prev, [barcodeCol.id]: text }));
    }
  };

  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumnData.name.trim()) return;

    // If making this the barcode column, unset others
    if (newColumnData.is_barcode) {
      await db.columns.where({ sheet_id: sheetId }).modify({ is_barcode: false });
    }

    await db.columns.add({
      id: crypto.randomUUID(),
      sheet_id: sheetId,
      name: newColumnData.name.trim(),
      type: newColumnData.type,
      is_barcode: newColumnData.is_barcode
    });

    setIsColumnModalOpen(false);
    setNewColumnData({ name: '', type: 'text', is_barcode: false });
  };

  const handleAddRow = async (e) => {
    e.preventDefault();
    await db.rows.add({
      id: crypto.randomUUID(),
      sheet_id: sheetId,
      values: newRowData,
      created_at: new Date().toISOString()
    });
    setIsRowModalOpen(false);
    setNewRowData({});
  };

  const handleDeleteRow = async (id) => {
    if (confirm('Delete this row?')) {
      await db.rows.delete(id);
    }
  };

  const handleDeleteColumn = async (id) => {
    if (confirm('Delete this column? This will remove data for this column in all rows.')) {
      await db.columns.delete(id);
    }
  };

  const updateRowValue = async (rowId, colId, value) => {
    const row = await db.rows.get(rowId);
    row.values[colId] = value;
    await db.rows.put(row);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    importFromCSV(file, sheetId, (success, message) => {
      alert(message);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  return (
    <div>
      <div className="header">
        <div className="flex items-center gap-4">
          <button className="btn-icon" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-gradient">{sheet.name}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>{rows.length} rows</p>
          </div>
        </div>
        <div className="header-actions">
          <input 
            type="file" 
            accept=".csv" 
            style={{ display: 'none' }} 
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} /> Import
          </button>
          <button className="btn btn-secondary" onClick={() => exportToCSV(sheetId, sheet.name)}>
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className="glass-card mb-6 header-actions" style={{ padding: '1rem', display: 'flex', gap: '1rem', border: 'none', background: 'transparent', boxShadow: 'none' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setIsRowModalOpen(true)}>
          <Plus size={18} /> Add Row
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsColumnModalOpen(true)}>
          <Plus size={18} /> Add Column
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.id}>
                  <div className="flex justify-between items-center gap-2">
                    <span 
                      className="flex items-center gap-1" 
                      style={{ cursor: 'pointer' }}
                      title="Click to rename column"
                      onClick={async () => {
                        const newName = prompt('Rename column:', col.name);
                        if (newName && newName.trim()) {
                          await db.columns.update(col.id, { name: newName.trim() });
                        }
                      }}
                    >
                      {col.name} {col.is_barcode && <Scan size={14} style={{ color: 'var(--accent-primary)' }}/>}
                    </span>
                    <button className="btn-icon" style={{ padding: '0.2rem', border: 'none' }} onClick={() => handleDeleteColumn(col.id)}>
                      <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                    </button>
                  </div>
                </th>
              ))}
              <th style={{ width: '60px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                {columns.map(col => (
                  <td key={col.id}>
                    <input
                      type={col.type === 'number' ? 'number' : 'text'}
                      style={{
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'inherit',
                        padding: '0.5rem',
                        width: '100%',
                        borderRadius: '4px',
                        outline: 'none'
                      }}
                      onFocus={e => e.target.style.border = '1px solid var(--accent-primary)'}
                      onBlur={e => e.target.style.border = '1px solid transparent'}
                      value={row.values[col.id] || ''}
                      onChange={(e) => updateRowValue(row.id, col.id, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button className="btn-icon" style={{ color: 'var(--danger)', border: 'none' }} onClick={() => handleDeleteRow(row.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No data yet. Scan a barcode or add a row manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Column Modal */}
      {isColumnModalOpen && (
        <div className="modal-overlay" onClick={() => setIsColumnModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="mb-6 text-gradient">Add New Column</h2>
            <form onSubmit={handleAddColumn}>
              <div className="input-group">
                <label className="input-label">Column Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newColumnData.name}
                  onChange={e => setNewColumnData({ ...newColumnData, name: e.target.value })}
                  placeholder="e.g. Quantity"
                  required
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label className="input-label">Data Type</label>
                <select 
                  className="input-field"
                  value={newColumnData.type}
                  onChange={e => setNewColumnData({ ...newColumnData, type: e.target.value })}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                </select>
              </div>
              <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  id="is_barcode"
                  checked={newColumnData.is_barcode}
                  onChange={e => setNewColumnData({ ...newColumnData, is_barcode: e.target.checked })}
                  style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-primary)' }}
                />
                <label htmlFor="is_barcode" className="input-label" style={{ cursor: 'pointer' }}>Set as Barcode Column</label>
              </div>
              <div className="flex justify-between mt-8">
                <button type="button" className="btn btn-secondary" onClick={() => setIsColumnModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Row Modal */}
      {isRowModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRowModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="mb-6 text-gradient">Add New Row</h2>
            <form onSubmit={handleAddRow}>
              {columns.map(col => (
                <div className="input-group" key={col.id}>
                  <label className="input-label">{col.name} {col.is_barcode && '(Barcode)'}</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type={col.type === 'number' ? 'number' : 'text'} 
                      className="input-field w-full" 
                      value={newRowData[col.id] || ''}
                      onChange={e => setNewRowData({ ...newRowData, [col.id]: e.target.value })}
                      autoFocus={col.is_barcode}
                    />
                    {col.is_barcode && (
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        style={{ padding: '0.75rem', flexShrink: 0 }}
                        onClick={() => setIsScannerOpen(true)}
                        title="Scan Barcode"
                      >
                        <Scan size={20} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-between mt-8">
                <button type="button" className="btn btn-secondary" onClick={() => setIsRowModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Row
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isScannerOpen && <ScannerModal onClose={() => setIsScannerOpen(false)} onScan={handleScan} />}
    </div>
  );
}
