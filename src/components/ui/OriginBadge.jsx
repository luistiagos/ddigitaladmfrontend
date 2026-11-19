export const TX_ORIGIN_OPTIONS = [
  { value: 'principal', label: 'Principal' },
  { value: 'adicional_checkout', label: 'Adicional (Checkout)' },
  { value: 'area_cliente', label: 'Área do cliente' },
  { value: 'recompra', label: 'Recompra' },
];

export const SALE_ORIGIN_OPTIONS = [
  { value: 'principal', label: 'Principal' },
  { value: 'principal_com_adicional', label: 'Principal + Adicionais' },
  { value: 'area_cliente', label: 'Área do cliente' },
  { value: 'recompra', label: 'Recompra' },
];

const ORIGIN_STYLES = {
  principal: 'text-gray-300 bg-gray-500/10 ring-1 ring-gray-500/30',
  adicional_checkout: 'text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30',
  principal_com_adicional: 'text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30',
  area_cliente: 'text-violet-300 bg-violet-500/15 ring-1 ring-violet-500/30',
  recompra: 'text-cyan-300 bg-cyan-500/15 ring-1 ring-cyan-500/30',
};

export default function OriginBadge({ row }) {
  const type = row?.origin_type;
  const label = row?.origin_label;
  if (!type && !label) {
    return <span className="text-gray-500 text-xs">—</span>;
  }
  const cls = ORIGIN_STYLES[type] || ORIGIN_STYLES.principal;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${cls}`}>
      <span>{label || type}</span>
      {row?.origin_estimated && (
        <span
          title="Classificação estimada (histórico anterior ao marcador explícito)"
          className="text-[10px] opacity-75"
        >
          (est.)
        </span>
      )}
    </span>
  );
}
