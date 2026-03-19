const VARIANT_MAP = {
  green: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  red: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  blue: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  gray: 'bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30',
  orange: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
};

export default function Badge({ variant = 'gray', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${VARIANT_MAP[variant] || VARIANT_MAP.gray}`}>
      {children}
    </span>
  );
}

/** Map a status string to a Badge variant */
export function statusVariant(status) {
  const s = (status || '').toLowerCase();
  if (['approved', 'ativo', 'purchase', 'success', '1'].includes(s)) return 'green';
  if (['charged_back', 'in_mediation', 'inativo', '0', 'cancelled'].includes(s)) return 'red';
  if (['pending', 'create', 'in_process'].includes(s)) return 'yellow';
  if (['refunded', 'reverted'].includes(s)) return 'orange';
  return 'gray';
}
