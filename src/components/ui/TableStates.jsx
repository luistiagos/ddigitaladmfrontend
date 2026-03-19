import { AlertCircle, RefreshCw } from 'lucide-react';

export function LoadingRows({ cols = 5, rows = 8 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} className="border-b border-gray-800">
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="px-4 py-3">
          <div className="h-4 bg-gray-700 rounded animate-pulse" style={{ width: `${60 + (j * 17) % 40}%` }} />
        </td>
      ))}
    </tr>
  ));
}

export function EmptyRow({ cols = 5, message = 'Nenhum registro encontrado.' }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center text-sm text-gray-500">
        {message}
      </td>
    </tr>
  );
}

export function ErrorRow({ cols = 5, message = 'Erro ao carregar dados.', onRetry }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-400" />
          <p className="text-sm text-gray-400">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
