import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { usePolling } from '../hooks/usePolling';
import { getOrders, fulfillOrder, createOrder } from '../api/orders';
import { getProducts } from '../api/products';
import Table from '../components/UI/Table';
import Badge from '../components/UI/Badge';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import StatCard from '../components/UI/StatCard';
import Modal from '../components/UI/Modal';
import { safeFormat } from '../utils/date';
import { formatINR } from '../utils/currency';
import toast from 'react-hot-toast';
import { ShoppingCart, CheckCircle, Clock, XCircle, Plus, Trash2 } from 'lucide-react';

export default function Orders() {
  const { data: orders, loading, refetch } = useApi(getOrders);
  const { data: products } = useApi(getProducts, true);
  
  usePolling(refetch, 10000);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ customerName: '', customerEmail: '', notes: '', items: [] });

  const handleFulfill = async (id) => {
    try {
      await fulfillOrder(id);
      toast.success('Order fulfilled successfully');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Fulfilment failed');
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setFormData({ customerName: '', customerEmail: '', notes: '', items: [{ productId: '', quantity: 1 }] });
  };

  const submitOrder = async (e) => {
    e.preventDefault();
    try {
      await createOrder({
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        notes: formData.notes,
        items: formData.items
          .filter(i => i.productId && i.quantity > 0)
          .map(i => ({ productId: parseInt(i.productId, 10), quantity: parseInt(i.quantity, 10) }))
      });
      toast.success('Order created');
      setIsModalOpen(false);
      refetch();
    } catch(err) {
      toast.error(err.message || 'Order creation failed');
    }
  };

  const addItem = () => setFormData({ ...formData, items: [...formData.items, { productId: '', quantity: 1 }] });
  const removeItem = (index) => setFormData({
    ...formData,
    items: formData.items.filter((_, i) => i !== index),
  });
  const updateItem = (index, field, value) => setFormData({
    ...formData,
    items: formData.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
  });

  const getStatusVariant = (st) => {
    switch(st) {
      case 'Pending': return 'warning';
      case 'Processing': return 'primary';
      case 'Fulfilled': return 'success';
      case 'Cancelled': return 'danger';
      default: return 'default';
    }
  };

  const stats = {
    Pending: orders?.filter(o => o.status === 'Pending').length || 0,
    Processing: orders?.filter(o => o.status === 'Processing').length || 0,
    Fulfilled: orders?.filter(o => o.status === 'Fulfilled').length || 0,
    Cancelled: orders?.filter(o => o.status === 'Cancelled').length || 0,
  };

  const columns = [
    { 
      header: 'Order #', 
      field: 'orderId', 
      altField: 'order_id',
      render: (val, row) => <span className="font-mono text-xs text-indigo-300 font-bold">ORD-{(val || row.order_id || '').toString().padStart(4, '0')}</span> 
    },
    { 
      header: 'Customer', 
      field: 'customerName',
      altField: 'customer_name',
      render: (val, row) => val || row.customer_name || '-'
    },
    { 
      header: 'Date', 
      field: 'orderDate', 
      altField: 'order_date',
      render: (val, row) => safeFormat(val || row.order_date || row.orderDate)
    },
    { 
      header: 'Amount', 
      field: 'totalAmount', 
      altField: 'total_amount',
      render: (val, row) => formatINR(val ?? row.total_amount ?? 0)
    },
    { 
      header: 'Shipment',
      field: 'trackingNumber',
      altField: 'tracking_number',
      render: (val, row) => {
        const track = val || row.trackingNumber || row.tracking_number;
        const status = row.shipmentStatus || row.shipment_status;
        return track ? (
          <div>
            <span className="font-mono text-xs text-slate-300">{track}</span>
            <div className="text-[10px] text-emerald-400 font-medium">{status}</div>
          </div>
        ) : (
          <span className="text-slate-500 text-xs italic">Unshipped</span>
        );
      }
    },
    { 
      header: 'Status', 
      field: 'status', 
      render: (val) => <Badge variant={getStatusVariant(val)}>{val}</Badge> 
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Order Management</h2>
        <button onClick={handleOpenModal} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium">
          <Plus size={16} /> New Order
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Pending" value={stats.Pending} icon={Clock} colorClass="text-amber-400" />
        <StatCard title="Processing" value={stats.Processing} icon={ShoppingCart} colorClass="text-indigo-400" />
        <StatCard title="Fulfilled" value={stats.Fulfilled} icon={CheckCircle} colorClass="text-emerald-400" />
        <StatCard title="Cancelled" value={stats.Cancelled} icon={XCircle} colorClass="text-red-400" />
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading && !orders ? <LoadingSpinner /> : (
          <Table 
            columns={columns} 
            data={orders || []} 
            keyField="orderId"
            renderRowActions={(row) => {
              const oid = row.orderId ?? row.order_id;
              return (
                <div className="flex justify-end gap-2">
                  {(row.status === 'Pending' || row.status === 'Processing') && (
                    <button 
                      onClick={() => handleFulfill(oid)} 
                      className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded border border-emerald-500/30 transition-colors font-medium"
                    >
                      Fulfil
                    </button>
                  )}
                </div>
              );
            }}
          />
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Order">
        <form onSubmit={submitOrder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Customer Name</label>
            <input required type="text" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Customer Email</label>
            <input required type="email" value={formData.customerEmail} onChange={e => setFormData({...formData, customerEmail: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500" rows="2" />
          </div>
          
          <div className="border-t border-slate-700 pt-4 mt-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-slate-300">Order Items</label>
              <button type="button" onClick={addItem} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                <Plus size={14} /> Add Item
              </button>
            </div>
            {formData.items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <select
                  required
                  value={item.productId}
                  onChange={e => updateItem(i, 'productId', e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="">Select product…</option>
                  {(products || []).map(p => {
                    const pid = p.productid || p.productId || p.ProductID;
                    const pname = p.productname || p.productName || p.ProductName;
                    const psku = p.sku || p.SKU;
                    const pprice = p.unitprice || p.unitPrice || p.UnitPrice;
                    return (
                      <option key={pid} value={pid}>
                        {pname} ({psku}) — {formatINR(pprice)}
                      </option>
                    );
                  })}
                </select>
                <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value, 10))} required className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm" />
                <button type="button" onClick={() => removeItem(i)} className="text-red-400 p-2 hover:bg-slate-700 rounded-lg"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Create Order</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}