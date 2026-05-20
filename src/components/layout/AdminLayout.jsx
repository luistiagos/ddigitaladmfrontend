import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
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
  Link,
  Gamepad2,
  Settings2,
  Tag,
  Receipt,
  Store,
  Package,
  Bot,
  MessageCircle,
  MailSearch,
  MailWarning,
  TriangleAlert,
  ChevronDown,
  Send as SendIcon,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SendProductModal from '@/modals/SendProductModal';
import SendMemberAreaLinkModal from '@/modals/SendMemberAreaLinkModal';

const NAV_GROUPS = [
  {
    key: 'comercial',
    label: 'Comercial',
    items: [
      { to: '/clientes',   label: 'Clientes',    icon: Users },
      { to: '/vendas',     label: 'Vendas',       icon: ShoppingCart },
      { to: '/transacoes', label: 'Transações',   icon: Receipt },
      { to: '/disputas',   label: 'Disputas',     icon: AlertOctagon },
      { to: '/leads',      label: 'Leads',        icon: Target },
    ],
  },
  {
    key: 'catalogo',
    label: 'Catálogo',
    items: [
      { to: '/produtos', label: 'Produtos', icon: Package },
      { to: '/stores',   label: 'Lojas',    icon: Store },
      { to: '/cupons',   label: 'Cupons',   icon: Tag },
    ],
  },
  {
    key: 'canais',
    label: 'Canais',
    items: [
      { to: '/bot',            label: 'Bot WhatsApp',      icon: Bot },
      { to: '/whatsapp-sessoes', label: 'Sessões WhatsApp', icon: MessageCircle },
      { to: '/email-activity', label: 'Atividade de Email', icon: MailSearch },
      { to: '/email-queue',    label: 'Fila de Emails',    icon: MailWarning },
    ],
  },
  {
    key: 'remarketing',
    label: 'Remarketing',
    items: [
      { to: '/remarketing/campanhas', label: 'Campanhas', icon: SendIcon },
      { to: '/remarketing/workflows', label: 'Workflows', icon: Activity },
      { to: '/remarketing/whatsapp-sender', label: 'WhatsApp Sender', icon: MessageCircle },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    items: [
      { to: '/configuracoes', label: 'Configurações', icon: Settings2 },
      { to: '/erros',         label: 'Log de Erros',  icon: TriangleAlert },
    ],
  },
];

const STORAGE_KEY = 'adminSidebarGroups';

function getInitialOpen(pathname) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* ignore */ }
  // Default: comercial open, others closed — unless something was already saved
  const defaults = { comercial: true, catalogo: false, canais: false, remarketing: false, sistema: false };
  return { ...defaults, ...saved };
}

function NavItem({ to, label, icon: Icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 pl-7 pr-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-violet-600/20 text-violet-300'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  );
}

function NavGroup({ groupKey, label, items, open, onToggle, onNavClick }) {
  return (
    <div>
      <button
        onClick={() => onToggle(groupKey)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        <span>{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <NavItem key={item.to} {...item} onClick={onNavClick} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [memberLinkModalOpen, setMemberLinkModalOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => getInitialOpen(location.pathname));

  // Auto-expand the group that owns the current route
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) =>
      g.items.some((item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/'))
    );
    if (activeGroup) {
      setOpenGroups((prev) => {
        if (prev[activeGroup.key]) return prev; // already open, no-op
        const next = { ...prev, [activeGroup.key]: true };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [location.pathname]);

  function toggleGroup(key) {
    setOpenGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

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

      {/* Quick action buttons */}
      <div className="px-3 pt-4 space-y-2">
        <button
          onClick={() => { setSendModalOpen(true); closeSidebar(); }}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <Send className="h-4 w-4" />
          Enviar Produto
        </button>
        <button
          onClick={() => { setMemberLinkModalOpen(true); closeSidebar(); }}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition-colors"
        >
          <Link className="h-4 w-4" />
          Link Área de Membros
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-3 space-y-1 overflow-y-auto">
        {/* Dashboard — item solo */}
        <NavLink
          to="/"
          end
          onClick={closeSidebar}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-violet-600/20 text-violet-300'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
            }`
          }
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          Dashboard
        </NavLink>

        {/* Grouped items */}
        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.key}
            groupKey={group.key}
            label={group.label}
            items={group.items}
            open={!!openGroups[group.key]}
            onToggle={toggleGroup}
            onNavClick={closeSidebar}
          />
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
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-gray-900 border-r border-gray-800">
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
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
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

      {/* Member Area Link Modal */}
      {memberLinkModalOpen && <SendMemberAreaLinkModal onClose={() => setMemberLinkModalOpen(false)} />}
    </div>
  );
}
