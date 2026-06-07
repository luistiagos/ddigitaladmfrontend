import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

/**
 * DetailModal — modal genérico para exibir conteúdo longo (mensagem inteira,
 * logs/stacktraces). Corpo rolável, monospace e opção de copiar.
 *
 * Props:
 *   title      string                 título do cabeçalho
 *   onClose    () => void             fecha o modal (botão X, Fechar e overlay)
 *   children   ReactNode              conteúdo custom (tem precedência sobre `text`)
 *   text       string                 quando sem children, exibe este texto (pre-wrap + copiar)
 */
export default function DetailModal({ title = 'Detalhe', onClose, children, text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível — ignora silenciosamente */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-gray-800 rounded-xl shadow-2xl border border-gray-700 flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-700 shrink-0">
          <h3 className="font-semibold text-white truncate">{title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {text != null && (
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                title="Copiar"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-auto">
          {children ?? (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-gray-300 leading-relaxed">
              {text || '—'}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
