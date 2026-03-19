import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 text-center">
      <LayoutDashboard className="h-12 w-12 text-gray-700 mb-4" />
      <h1 className="text-xl font-semibold text-gray-300">Dashboard</h1>
      <p className="text-sm text-gray-500 mt-2">Em breve — métricas e resumos.</p>
    </div>
  );
}
