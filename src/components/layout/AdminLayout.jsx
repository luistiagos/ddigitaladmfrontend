import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  AlertOctagon,
  Target,
  LogOut,
  Menu,
  X,
  Send,
  Gamepad2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SendProductModal from '@/modals/SendProductModal';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { to: '/disputas', label: 'Disputas', icon: AlertOctagon },
  { to: '/leads', label: 'Leads', icon: Target },
];

function NavItem({ to, label, icon: Icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-violet-600/20 text-violet-300'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
        }`
      }
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </NavLink>
  );
}

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const closeSidebar = () => setSidebarOpen(false);

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-800">
        <Gamepad2 className="h-6 w-6 text-violet-400" />
        <div>
          <div className="text-sm font-bold text-white leading-tight">Digital Store</div>
          <div className="text-xs text-violet-400 leading-tight">Admin Panel</div>
        </div>
      </div>

      {/* Send Product button */}
      <div className="px-3 pt-4">
        <button
          onClick={() => { setSendModalOpen(true); closeSidebar(); }}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <Send className="h-4 w-4" />
          Enviar Produto
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 pt-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} onClick={closeSidebar} />
        ))}
      </nav>

      {/* Admin info + logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="text-xs text-gray-500 truncate mb-2 px-1">{admin?.email}</div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800">
        {SidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={closeSidebar}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        {SidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <span className="text-xs text-gray-500 hidden sm:block">{admin?.email}</span>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Send Product Modal */}
      {sendModalOpen && <SendProductModal onClose={() => setSendModalOpen(false)} />}
    </div>
  );
}
