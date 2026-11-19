# Tailwind — sempre a classe nativa/canônica

Este projeto usa **Tailwind v4** (`tailwindcss@4.x`). No v4 a escala de espaçamento é contínua (`--spacing: 0.25rem` = 4px por unidade, aceitando frações como `.5`/`.25`/`.75`), então quase todo valor em px tem uma classe nativa equivalente. **Sempre use a classe nativa quando ela existir**: valor arbitrário (`[...]`) só entra quando não há equivalente.

É exatamente o que o IntelliSense do Tailwind avisa: *"The class `min-h-[34px]` can be written as `min-h-8.5`"*. Esse aviso não pode ficar no código.

## Como converter

| Utilitário | Regra | Exemplos |
|---|---|---|
| Espaçamento/tamanho (`w`, `h`, `min-*`, `max-*`, `p*`, `m*`, `gap`, `inset*`, `top/left/...`, `translate-*`, `size`) | `px ÷ 4` | `w-[18px]` → `w-4.5`, `h-[67px]` → `h-16.75`, `min-h-[420px]` → `min-h-105`, `gap-[3px]` → `gap-0.75`, `-top-[22px]` → `-top-5.5` |
| `max-w` em px | também `px ÷ 4` (não é a escala `max-w-sm/md/...`) | `max-w-[180px]` → `max-w-45`, `max-w-[640px]` → `max-w-160` |
| `rounded` | escala de raio | `[2px]`→`xs`, `[4px]`→`sm`, `[6px]`→`md`, `[8px]`→`lg`, `[12px]`→`xl`, `[16px]`→`2xl` |
| `border` (largura) | o número em px vira o sufixo | `border-[10px]` → `border-10`, `md:border-[14px]` → `md:border-14` |
| `z` | sem colchetes | `z-[300]` → `z-300` |
| `leading` | nomes da escala | `leading-[1.5]` → `leading-normal` |
| `aspect` | fração direta | `aspect-[5/7]` → `aspect-5/7` |
| `transition` | utilitário nomeado | `transition-[box-shadow]` → `transition-shadow` |
| Negativos arbitrários | sinal dentro do valor | `-translate-x-[12%]` → `translate-x-[-12%]` |

Valores em `rem` seguem a mesma conta (`1rem` = 16px = `4`).

## Quando o valor arbitrário continua válido

- Não existe classe nativa equivalente (ex.: `shadow-[0_2px_0_rgba(...)]`, `bg-[radial-gradient(...)]`, `grid-cols-[1fr_auto_1fr]`, `w-[calc(...)]`, `rotate-[17deg]` quando não há escala).
- Cores fora das paletas do `tailwind.config.mjs` (prefira sempre adicionar à paleta se a cor se repete).

Na dúvida, não adivinhe: rode o verificador abaixo.

## Verificador

`configs/scripts/tailwind-canonical.mjs` usa o mesmo motor do aviso do IntelliSense (`designSystem.canonicalizeCandidates`) sobre todos os `.ts/.tsx/.js/.mjs/.css` versionados:

```bash
npm run lint:tailwind          # lista arquivo:linha  classe → canônica; sai com código 1 se achar algo
npm run lint:tailwind -- --fix # reescreve as classes no lugar
```

Rode depois de escrever ou editar classes Tailwind. Ao corrigir, atenção a **seletores que dependem do nome da classe** (ex.: `[class*="z-300"]` em testes Playwright): eles precisam mudar junto.

## Erros comuns

```tsx
{/* ❌ Errado */}
<div className="min-h-[34px] rounded-[6px] border-[10px] z-[300]" />

{/* ✅ Correto */}
<div className="min-h-8.5 rounded-md border-10 z-300" />
```
