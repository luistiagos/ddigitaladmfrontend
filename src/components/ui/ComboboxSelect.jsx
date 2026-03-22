import { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';

/**
 * ComboboxSelect — input de pesquisa com dropdown de opções filtradas.
 *
 * @param {Array<{value: string|number, label: string}>}  options      Lista de opções
 * @param {string|number}                                 value        Valor selecionado (controlado)
 * @param {function(string|number)}                       onChange     Callback ao selecionar
 * @param {string}                                        placeholder  Placeholder do input (padrão: "Pesquisar…")
 * @param {boolean}                                       disabled     Desabilita o componente
 * @param {string}                                        className    Classes extras no wrapper
 * @param {string}                                        inputClassName Classes extras no input
 * @param {boolean}                                       required     Atributo required do input
 * @param {string}                                        id           id do input (para label htmlFor)
 * @param {string}                                        noResultsText Texto quando não há resultados
 */
export function ComboboxSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Pesquisar produto…',
  disabled = false,
  className = '',
  inputClassName = '',
  required = false,
  id,
  noResultsText = 'Nenhum resultado encontrado',
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const listboxId = `${inputId}-listbox`;

  // The text shown in the input (label of selected item, or search query)
  const selectedLabel = options.find((o) => String(o.value) === String(value))?.label ?? '';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filtered list
  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase())
      )
    : options;

  // Sync display text when value changes externally
  const displayValue = open ? query : selectedLabel;

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIndex];
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function openDropdown() {
    if (disabled) return;
    setQuery('');
    setOpen(true);
    setActiveIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function selectOption(opt) {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  }

  function clearSelection(e) {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleInputChange(e) {
    setQuery(e.target.value);
    setActiveIndex(-1);
    if (!open) setOpen(true);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && filtered[activeIndex]) {
          selectOption(filtered[activeIndex]);
        } else if (filtered.length === 1) {
          selectOption(filtered[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setQuery('');
        setActiveIndex(-1);
        break;
      case 'Tab':
        setOpen(false);
        setQuery('');
        setActiveIndex(-1);
        break;
    }
  }

  const hasValue = value !== '' && value != null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div
        className={`
          flex items-center gap-2
          w-full rounded-lg border px-3 py-2.5
          bg-gray-700/50 border-gray-600
          ${open ? 'ring-2 ring-violet-500/50 border-violet-500' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
          transition
        `}
        onClick={openDropdown}
      >
        <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          required={required && !hasValue}
          disabled={disabled}
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => { if (!open) openDropdown(); }}
          onKeyDown={handleKeyDown}
          placeholder={hasValue ? selectedLabel : placeholder}
          className={`
            flex-1 min-w-0 bg-transparent text-sm text-white placeholder-gray-500
            focus:outline-none
            ${disabled ? 'cursor-not-allowed' : ''}
            ${inputClassName}
          `}
        />

        {/* Clear button */}
        {hasValue && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={clearSelection}
            className="text-gray-400 hover:text-white transition-colors shrink-0"
            aria-label="Limpar seleção"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Chevron */}
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="
            absolute z-50 mt-1 w-full
            max-h-60 overflow-y-auto
            rounded-lg border border-gray-600
            bg-gray-800 shadow-xl
            py-1
          "
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 select-none">{noResultsText}</li>
          ) : (
            filtered.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const isActive = idx === activeIndex;
              return (
                <li
                  key={opt.value}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onPointerDown={(e) => {
                    e.preventDefault(); // prevent blur before click fires
                    selectOption(opt);
                  }}
                  className={`
                    px-3 py-2 text-sm cursor-pointer select-none
                    ${isActive ? 'bg-violet-600 text-white' : isSelected ? 'bg-violet-600/20 text-violet-300' : 'text-gray-200 hover:bg-gray-700'}
                  `}
                >
                  {opt.label}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default ComboboxSelect;
