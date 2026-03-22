# ComboboxSelect — Componente de Seleção com Autocomplete

Adicionado em **2026-03-21**.

---

## Localização

```
ddigitaladmfrontend/src/components/ui/ComboboxSelect.jsx
```

---

## Problema resolvido

O campo de seleção de produto usava um `<select>` HTML nativo. Com muitos produtos no catálogo, encontrar o produto certo exigia rolar por toda a lista — lento e propenso a erros.

---

## Solução

Componente customizado `ComboboxSelect` que combina:
- **Input de texto** para digitar e filtrar opções em tempo real
- **Dropdown** com a lista filtrada, atualizando a cada keystroke
- **Navegação por teclado** (setas, Enter, Escape)
- **Botão de limpar** para remover a seleção atual
- **Acessibilidade** (ARIA: `role="combobox"`, `role="listbox"`, `aria-expanded`, `aria-selected`, `aria-activedescendant`)

Não foi adicionada nenhuma dependência externa — o componente é 100% customizado com React + Tailwind.

---

## API

```jsx
<ComboboxSelect
  options={[{ value, label }]}  // array de opções (obrigatório)
  value={productId}             // valor selecionado — controlado
  onChange={setProductId}       // callback: recebe o value da opção
  placeholder="Pesquisar…"     // placeholder do input
  disabled={false}              // desabilita o componente
  required={false}              // atributo required no input oculto
  id="my-input"                 // id do input (para label htmlFor)
  noResultsText="Sem resultados" // texto quando nenhuma opção bate
  className=""                  // classes extras no wrapper
  inputClassName=""             // classes extras no input
/>
```

### Propriedades

| Prop             | Tipo                     | Padrão                         | Descrição                            |
|------------------|--------------------------|--------------------------------|--------------------------------------|
| `options`        | `{value, label}[]`       | `[]`                           | Lista de opções                      |
| `value`          | `string \| number`       | —                              | Valor selecionado (controlado)       |
| `onChange`       | `(value) => void`        | —                              | Callback de seleção                  |
| `placeholder`    | `string`                 | `"Pesquisar produto…"`         | Placeholder do input                 |
| `disabled`       | `boolean`                | `false`                        | Desabilita interação                 |
| `required`       | `boolean`                | `false`                        | Marca o campo como obrigatório       |
| `id`             | `string`                 | auto-gerado                    | ID do input (para `<label>`)         |
| `noResultsText`  | `string`                 | `"Nenhum resultado encontrado"` | Mensagem de lista vazia              |
| `className`      | `string`                 | `""`                           | Classes extras no container          |
| `inputClassName` | `string`                 | `""`                           | Classes extras no `<input>`          |

---

## Comportamento

### Filtro
- A lista é filtrada a cada keystroke usando `String.includes` case-insensitive
- Com campo vazio, exibe todas as opções
- Label curta como `"PS2"` bate em `"Jogos PS2 Platinum"`

### Teclado
| Tecla        | Ação                                                  |
|--------------|-------------------------------------------------------|
| `ArrowDown`  | Move o foco para o próximo item                       |
| `ArrowUp`    | Move o foco para o item anterior                      |
| `Enter`      | Seleciona o item em foco (ou o único resultado)       |
| `Escape`     | Fecha o dropdown e limpa a pesquisa                   |
| `Tab`        | Fecha o dropdown (foco avança normalmente)            |

### Seleção
- Ao selecionar: o input exibe o label do item; `onChange` recebe o `value`
- Clique fora do componente: fecha e descarta a pesquisa sem alterar a seleção
- Botão `×`: limpa a seleção e o input

---

## Uso

### Em formulário controlado

```jsx
import { ComboboxSelect } from '@/components/ui/ComboboxSelect';

const [productId, setProductId] = useState('');

<ComboboxSelect
  options={products.map((p) => ({ value: p.id, label: p.title }))}
  value={productId}
  onChange={setProductId}
  placeholder="Pesquisar produto…"
  required
/>
```

### Com label externo

```jsx
<label htmlFor="produto-input">Produto *</label>
<ComboboxSelect
  id="produto-input"
  options={options}
  value={value}
  onChange={onChange}
/>
```

---

## Onde está sendo usado

| Arquivo                               | Campo substituído      |
|---------------------------------------|------------------------|
| `src/modals/SendProductModal.jsx`     | Campo "Produto *"      |

---

## Visual

```
┌─────────────────────────────────────────┐
│ 🔍  Jogos PS2                     ×  ∨  │  ← input + clear + chevron
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ Jogos PS2 Platinum                       │  ← item ativo (violeta)
│ Jogos PS2 Clássicos                      │
│ Jogos PS2 Action                         │
└─────────────────────────────────────────┘
```

---

## Design system

O componente segue o padrão visual do admin:
- Background: `bg-gray-700/50`
- Borda padrão: `border-gray-600`
- Foco: `ring-2 ring-violet-500/50 border-violet-500`
- Item ativo/selecionado: `bg-violet-600`
- Dropdown: `bg-gray-800 border-gray-600`
