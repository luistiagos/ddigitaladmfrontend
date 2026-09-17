/** Rotulo + campo das barras de filtro das telas de WhatsApp. */
export default function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}
