import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Modal from '../UI/Modal';
import { updateInventoryItem } from '../../api/inventory';

// Edits the quantity of each product in one bin. The database trigger
// trg_bin_stock_sync re-computes Bin.CurrentStock, rejects anything above
// capacity and raises an Overstocked alert when the bin reaches 100%.
export default function AdjustStockModal({ bin, onClose, onSaved }) {
  const [quantities, setQuantities] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bin) return;
    setQuantities(Object.fromEntries(bin.items.map((item) => [item.inventoryItemId, item.quantity])));
  }, [bin]);

  if (!bin) return null;

  const plannedTotal = bin.items.reduce(
    (sum, item) => sum + (Number(quantities[item.inventoryItemId]) || 0), 0);

  const save = async (e) => {
    e.preventDefault();
    const newQty = (item) => Number(quantities[item.inventoryItemId]);
    // Save decreases before increases: the trigger checks capacity after every
    // single update, so moving units between products in a full bin must free
    // space first.
    const changed = bin.items
      .filter((item) => newQty(item) !== item.quantity)
      .sort((a, b) => (newQty(a) - a.quantity) - (newQty(b) - b.quantity));
    if (changed.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      for (const item of changed) {
        await updateInventoryItem(item.inventoryItemId, newQty(item));
      }
      toast.success(`Bin ${bin.binCode} updated - trigger re-synced stock`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Update rejected by the database');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Adjust stock - ${bin.binCode}`}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-400">
          Capacity <span className="text-white font-medium">{bin.capacity}</span> units ·
          after save <span className={plannedTotal > bin.capacity ? 'text-red-400 font-medium' : 'text-white font-medium'}>{plannedTotal}</span> units
        </p>
        {bin.items.map((item) => (
          <div key={item.inventoryItemId} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm text-white">{item.productName}</div>
              <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
            </div>
            <input
              type="number"
              min="0"
              required
              value={quantities[item.inventoryItemId] ?? ''}
              onChange={(e) => setQuantities({ ...quantities, [item.inventoryItemId]: e.target.value })}
              className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        ))}
        <div className="pt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
