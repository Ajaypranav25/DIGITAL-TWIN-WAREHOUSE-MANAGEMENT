import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AppLayout from './components/Layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Alerts from './pages/Alerts';
import Orders from './pages/Orders';
import Sensors from './pages/Sensors';
import Snapshots from './pages/Snapshots';

function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: '#1e293b',
          color: '#f8fafc',
          border: '1px solid #334155'
        }
      }} />
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="orders" element={<Orders />} />
          <Route path="sensors" element={<Sensors />} />
          <Route path="snapshots" element={<Snapshots />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;