import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import PrivateRoute from '@/components/PrivateRoute';
import AdminLayout from '@/components/layout/AdminLayout';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import Sales from '@/pages/Sales';
import Disputes from '@/pages/Disputes';
import Leads from '@/pages/Leads';
import Settings from '@/pages/Settings';
import Coupons from '@/pages/Coupons';
import Transactions from '@/pages/Transactions';
import Stores from '@/pages/Stores';
import Products from '@/pages/Products';
import BotConfig from '@/pages/BotConfig';
import WhatsAppSessions from '@/pages/WhatsAppSessions';
import EmailActivity from '@/pages/EmailActivity';
import EmailQueue from '@/pages/EmailQueue';
import ErrorLog from '@/pages/ErrorLog';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <PrivateRoute>
                <AdminLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clients />} />
            <Route path="vendas" element={<Sales />} />
            <Route path="disputas" element={<Disputes />} />
            <Route path="leads" element={<Leads />} />
            <Route path="configuracoes" element={<Settings />} />
            <Route path="bot" element={<BotConfig />} />
            <Route path="cupons" element={<Coupons />} />
            <Route path="transacoes" element={<Transactions />} />
            <Route path="stores" element={<Stores />} />
            <Route path="produtos" element={<Products />} />
            <Route path="whatsapp-sessoes" element={<WhatsAppSessions />} />
            <Route path="email-activity" element={<EmailActivity />} />
            <Route path="email-queue" element={<EmailQueue />} />
            <Route path="erros" element={<ErrorLog />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
