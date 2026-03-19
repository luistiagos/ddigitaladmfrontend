import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', danger = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-sm bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${danger ? 'text-red-400' : 'text-yellow-400'}`} />
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
