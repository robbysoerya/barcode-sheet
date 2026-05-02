import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Table as TableIcon } from 'lucide-react';
import { db } from '../db';

export default function Dashboard() {
  const navigate = useNavigate();
  const sheets = useLiveQuery(() => db.sheets.toArray()) || [];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');

  const [editingSheetId, setEditingSheetId] = useState(null);
  const [editSheetName, setEditSheetName] = useState('');

  const createSheet = async (e) => {
    e.preventDefault();
    if (!newSheetName.trim()) return;
    
    const id = crypto.randomUUID();
    await db.sheets.add({
      id,
      name: newSheetName.trim(),
      created_at: new Date().toISOString()
    });
    
    // Create a default Barcode column
    await db.columns.add({
      id: crypto.randomUUID(),
      sheet_id: id,
      name: 'Barcode',
      type: 'text',
      is_barcode: true
    });

    setIsModalOpen(false);
    setNewSheetName('');
    navigate(`/sheet/${id}`);
  };

  const deleteSheet = async (id, e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this sheet? All data will be lost.')) {
      await db.sheets.delete(id);
      // Clean up columns and rows
      await db.columns.where({ sheet_id: id }).delete();
      await db.rows.where({ sheet_id: id }).delete();
    }
  };

  const startEditingSheet = (sheet, e) => {
    e.stopPropagation();
    setEditingSheetId(sheet.id);
    setEditSheetName(sheet.name);
  };

  const saveSheetName = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editSheetName.trim() || !editingSheetId) return;
    
    await db.sheets.update(editingSheetId, { name: editSheetName.trim() });
    setEditingSheetId(null);
    setEditSheetName('');
  };

  return (
    <div>
      <div className="header">
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>BarcodeSheet</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage and scan your barcodes easily</p>
        </div>
        <div className="header-actions">
          <button id="btn-new-sheet" className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={20} /> New Sheet
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {sheets.map(sheet => (
          <div 
            key={sheet.id} 
            className="glass-card"
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            onClick={() => {
              if (editingSheetId !== sheet.id) {
                navigate(`/sheet/${sheet.id}`);
              }
            }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2" style={{ flex: 1, marginRight: '1rem' }}>
                <TableIcon size={24} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                {editingSheetId === sheet.id ? (
                  <form onSubmit={saveSheetName} style={{ display: 'flex', width: '100%', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={editSheetName}
                      onChange={e => setEditSheetName(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                      style={{ padding: '0.25rem 0.5rem', fontSize: '1rem', width: '100%' }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }} onClick={e => e.stopPropagation()}>Save</button>
                  </form>
                ) : (
                  <h3 style={{ wordBreak: 'break-word' }} onClick={(e) => startEditingSheet(sheet, e)} title="Click to rename">{sheet.name}</h3>
                )}
              </div>
              <button 
                className="btn-icon" 
                onClick={(e) => deleteSheet(sheet.id, e)}
                style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', flexShrink: 0 }}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Created: {new Date(sheet.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
        {sheets.length === 0 && (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
            <TableIcon size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ color: 'var(--text-secondary)' }}>No sheets yet</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Create a new sheet to start scanning.</p>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={20} /> Create First Sheet
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="mb-6 text-gradient">Create New Sheet</h2>
            <form onSubmit={createSheet}>
              <div className="input-group">
                <label className="input-label">Sheet Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newSheetName}
                  onChange={e => setNewSheetName(e.target.value)}
                  placeholder="e.g. Inventory Scan"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-between mt-8">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
