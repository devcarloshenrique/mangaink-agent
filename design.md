# Google Stitch — Design de Arquitetura de UI/UX

> **Ferramenta:** [stitch.withgoogle.com](https://stitch.withgoogle.com/) — AI-powered UI/UX design generation
> **Propósito:** Gerar protótipos visuais de alta fidelidade para o MangaInk Agent, acelerando iteração de design sem depender de preparação manual de assets no Figma. O Stitch atua como **ferramenta de exploração visual** — a implementação final é feita manualmente com React + Tailwind v4 + shadcn/ui + tema neo-brutalista comic pop-art.

---

## 1. Motivação

O MangaInk Agent possui um design system temático consolidado (neo-brutalist comic pop-art: paleta vibrante, bordas pretas chapadas `3px`, sombras offset **sem blur**, fonte Bangers, halftone dots, painéis com tilt), mas a criação de novos layouts e páginas depende de prototipagem manual no código ou em ferramentas externas como Figma.

O Google Stitch resolve o gargalo de **exploração visual rápida**:

1. **Geração instantânea** de wireframes e mockups a partir de descrições textuais em português
2. **Iteração acelerada** — refinar visualmente antes de escrever código
3. **Exploração de variações** — comparar layouts alternativos em segundos
4. **Comunicação equipe** — referência visual concreta para discussões de design

**O Stitch NÃO gera código React/JSX** — ele produz HTML/CSS genérico. A conversão para o stack do projeto é sempre manual, guiada por este documento.

---

## 2. O Gap — O Que o Stitch Gera vs O Que o MangaInk Precisa

O Stitch, por padrão, gera designs seguindo convenções modernas de UI (Material Design, superfícies com elevação sutil, bordas finas, sombras com blur, tipografia genérica). O MangaInk exige um estilo **neo-brutalista comic** radicalmente diferente.

### 2.1. Tema Gerado pelo Stitch (Referência)

```yaml
# Output típico do Stitch — NÃO é o tema real do MangaInk
# Cores são aceitáveis como ponto de partida; componentes NÃO seguem o estilo
colors:
  comic-red: '#BD3126'
  comic-yellow: '#F7DE61'
  comic-blue: '#2D68D1'
  comic-cream: '#F9F8F3'
  comic-ink: '#0B0E17'
typography:
  headline-xl: { fontFamily: Anybody, fontSize: 48px, fontWeight: 900 }
  headline-lg: { fontFamily: Anybody, fontSize: 32px, fontWeight: 800 }
  headline-md: { fontFamily: Anybody, fontSize: 24px, fontWeight: 800 }
  body-lg:     { fontFamily: Inter,   fontSize: 18px, fontWeight: 400 }
  body-md:     { fontFamily: Inter,   fontSize: 16px, fontWeight: 400 }
  label-md:    { fontFamily: Anybody, fontSize: 14px, fontWeight: 700 }
  label-sm:    { fontFamily: Inter,   fontSize: 12px, fontWeight: 600 }
```

> **As cores hex são compatíveis** com nossa paleta oklch e podem ser usadas como referência visual. **O problema está nos componentes**: o Stitch aplica essas cores em um estilo Material Design polido, não neo-brutalista.

### 2.2. Comparação por Atributo

| Atributo | Stitch (default) | MangaInk (neo-brutalist) |
|----------|-----------------|--------------------------|
| **Bordas** | `1px solid #E0E0E0` ou sutis | **`3px solid #0B0E17`** (`border-[3px] border-ink`) |
| **Sombras** | `0 4px 12px rgba(0,0,0,0.15)` — **COM blur** | **`6px 6px 0 0 #0B0E17`** — **SEM blur, chapada** |
| **Fonte display** | Anybody, genérica ou sans-serif | **Bangers** (comic book lettering) |
| **Fonte corpo** | Inter (ok) | **Inter** (mesmo — OK) |
| **Cantos** | `border-radius: 8-16px` suave | `rounded-xl` (12px) **com borda preta** |
| **Background** | Cor sólida, gradiente suave | Cor sólida + **halftone dots** ou **stripes** |
| **Interatividade** | `opacity: 0.8` no hover | **`-translate-y-0.5`** (lift físico) + `transition-transform` |
| **Badges** | Pill arredondado suave | **`clip-path: polygon(...)` jagged** + `-rotate-3` |
| **Tooltips** | Caixa retangular com sombra | **`SpeechBubble`** com tail CSS triangular |
| **Layout** | Alinhamento perfeito em grid | Grid com **tilt alternado** (`-rotate-1` / `rotate-1`) |
| **Divisores** | `border-bottom: 1px solid #EEE` | **`divide-y-2 divide-dashed divide-ink/30`** |
| **Gradientes** | Frequentes | **PROIBIDOS** (exceto halftone decorativo) |

### 2.3. Diagnóstico: O Que Acontece se Usar o Output Bruto do Stitch

- O site perde **toda a identidade visual comic**
- As bordas finas e sombras com blur transformam o visual em "mais um dashboard genérico"
- A fonte Anybody (ou similar) remove o caráter de quadrinho
- Os cantos arredondados sem borda grossa parecem Material Design, não pop-art
- A ausência de halftone, tilt, onomatopeias e speech bubbles elimina o diferencial do projeto

**Conclusão:** O Stitch serve para validar **layout e fluxo**. A **estética neo-brutalista comic** é 100% responsabilidade do desenvolvedor no código.

---

## 3. Princípios de Design

### 3.1. Stitch como Explorador de Layout, Não de Estilo

O Stitch gera HTML/CSS genérico que não segue o design system do projeto. O output serve como **referência de layout e fluxo de informação**, nunca como referência de estilo visual.

**Decisão:** Validar posicionamento de elementos, hierarquia de informação e fluxo de navegação no Stitch. **Estilo visual (bordas, sombras, fontes, cores, texturas) é sempre aplicado no código.**

### 3.2. Idioma dos Prompts: Português Brasileiro com Descritores Neo-Brutalist

A UI do MangaInk é 100% em português. Prompts em inglês produzem labels que exigiriam tradução.

**Decisão:** Todos os prompts são em **Português Brasileiro**. Incluir SEMPRE os descritores neo-brutalist: "borda preta grossa 3px", "sombra chapada sem blur", "estilo comic book", "fonte bold display", "halftone dots".

### 3.3. O Prompt Deve "Lutar" Contra o Viés do Stitch

O Stitch tem viés para Material Design limpo e polido. Para obter um output que minimize o gap, o prompt precisa ser agressivo nas restrições.

**Decisão:** Incluir explicitamente o que **NÃO** fazer: "SEM gradientes", "SEM sombras com blur", "SEM bordas finas", "SEM fontes genéricas". Ver template na seção §5.1.

### 3.4. Component-First, Não Page-First

Gerar uma página inteira no Stitch é útil para validação de layout macro, mas o output tende a ser genérico demais.

**Decisão:** Preferir prompts focados em **um componente por vez** (modal, card, formulário, tabela). Para páginas completas, gerar primeiro cada componente isoladamente, depois a composição final.

### 3.5. Responsividade Implícita

O Stitch gera designs em resolução fixa (viewport desktop). A responsividade (mobile-first, breakpoints Tailwind) é adicionada manualmente.

**Decisão:** O design do Stitch representa o **breakpoint desktop** (`lg:`). Breakpoints menores (`sm:`, `md:`) são inferidos durante a codificação.

---

## 4. Guia de Brutalização — 10 Regras para Transformar Stitch → Neo-Brutalist Comic

Esta seção é o **núcleo do documento**. Cada regra descreve exatamente qual transformação aplicar ao output do Stitch para convertê-lo ao estilo neo-brutalista do MangaInk.

```
┌─────────────────────────────────────────────────────────────────┐
│                 PIPELINE DE BRUTALIZAÇÃO                         │
│                                                                  │
│  Output Stitch           Transformação          Código MangaInk  │
│  (Material Design)  ───► 10 Regras  ───►  (Neo-Brutalist Comic) │
│                                                                  │
│  border: 1px #CCC   →  REGRA 01  →  border-[3px] border-ink     │
│  shadow: blur 12px  →  REGRA 02  →  shadow-comic (0 0 blur)     │
│  font: Anybody      →  REGRA 03  →  font-display (Bangers)      │
│  bg: solid cream    →  REGRA 04  →  bg-halftone                 │
│  layout: reto       →  REGRA 05  →  tilt left/right             │
│  badge: pill        →  REGRA 06  →  OnomatopoeiaBadge           │
│  tooltip: box       →  REGRA 07  →  SpeechBubble                │
│  divider: solid     →  REGRA 08  →  divide-dashed               │
│  hover: opacity     →  REGRA 09  →  -translate-y-0.5            │
│  gradient: presente →  REGRA 10  →  PROIBIDO                    │
└─────────────────────────────────────────────────────────────────┘
```

### REGRA 01 — Toda Borda Vira `border-[3px] border-ink`

O Stitch gera bordas de `1px` em cinza claro (`#E0E0E0`). No MangaInk, **toda borda decorativa** usa `3px` sólido preto.

- **Antes (Stitch):** `border: 1px solid #e2e8f0; border-radius: 12px;`
- **Depois (MangaInk):** `border-[3px] border-ink rounded-xl`
- **Exceções:** Bordas internas de tabela podem usar `2px`. Elementos puramente estruturais (não decorativos) podem usar `border-ink` com `2.5px` (nav links inativos).

### REGRA 02 — Toda Sombra Perde o Blur (Zero!)

O Stitch gera `box-shadow: 0 4px 12px rgba(0,0,0,0.15)` — **com blur de 12px**. Esta é a violação mais grave do estilo neo-brutalista.

- **Antes (Stitch):** `box-shadow: 0 4px 12px rgba(0,0,0,0.15);` ← blur = 12px ❌
- **Depois (MangaInk):** `shadow-comic` = `6px 6px 0 0 var(--comic-ink)` ← blur = 0 ✅
- **Regra de escolha:** `shadow-comic` para cards/painéis (padrão), `shadow-comic-sm` para badges/inputs, `shadow-comic-lg` para modais/hero
- **Única exceção:** `animate-pulse-glow` para elementos em progresso (é uma animação, não estilo estático)

### REGRA 03 — Toda Fonte Display Vira Bangers (`font-display`)

O Stitch pode usar Anybody, system-ui, ou fontes genéricas para headlines.

- **Antes (Stitch):** `font-family: "Anybody", sans-serif;`
- **Depois (MangaInk):** `font-display` (Bangers para títulos, labels, botões, badges, stats)
- **Corpo de texto:** `font-sans` (Inter) — aqui o Stitch geralmente acerta
- **Regra mnemônica:** Se o texto for **UI chrome** (heading, botão, label, badge, nav) → Bangers. Se for **conteúdo** (parágrafo, descrição, placeholder) → Inter.

### REGRA 04 — Fundos Lisos Ganham Textura (Halftone ou Stripes)

O Stitch usa fundos de cor sólida. O MangaInk aplica texturas de quadrinhos.

- **Antes (Stitch):** `background-color: #F9F8F3;` (cream sólido)
- **Depois (MangaInk):** `bg-comic-cream bg-halftone` (cream + pontinhos pretos)
- **Opções:** `bg-halftone` (esparso, 14px), `bg-halftone-dense` (denso, 8px), `bg-halftone-red` (vermelho, 12px), `bg-comic-stripes` (listras diagonais)
- **Dica:** Halftone sobre fundo amarelo (`bg-comic-yellow bg-halftone`) com `opacity-25` cria o efeito Ben-Day dots clássico

### REGRA 05 — Containers Retos Ganham Tilt (`-rotate-1` / `rotate-1`)

O Stitch alinha tudo perfeitamente. O MangaInk aplica rotações sutis para simular colagem manual.

- **Antes (Stitch):** Grid perfeitamente alinhado, sem rotação
- **Depois (MangaInk):** `<ComicPanel tilt="left">` / `tilt="right"` alternado por índice (`i % 2 === 0 ? "left" : "right"`)
- **Badges:** `-rotate-3` (OnomatopoeiaBadge)
- **Badge hero:** `-rotate-2` (dashboard "Mangaink")
- **Logo hover:** `group-hover:-rotate-12`

### REGRA 06 — Badges e Tags Viram `<OnomatopoeiaBadge>`

O Stitch gera badges como pills arredondados (`border-radius: 999px`). O MangaInk usa badges com `clip-path` irregular.

- **Antes (Stitch):** `<span class="badge">POW!</span>` → pill arredondado
- **Depois (MangaInk):** `<OnomatopoeiaBadge variant="yellow" size="sm">POW!</OnomatopoeiaBadge>` → jagged polygon clip-path, `-rotate-3`, `font-display`
- **Variantes:** `yellow`, `red`, `blue`
- **Tamanhos:** `sm` (text-2xl), `md` (text-4xl, padrão), `lg` (text-6xl)

### REGRA 07 — Tooltips e Mensagens Viram `<SpeechBubble>`

O Stitch gera tooltips como caixas retangulares padrão. O MangaInk usa balões de fala com tail CSS triangular.

- **Antes (Stitch):** `<div class="tooltip">Dica aqui</div>` → caixa retangular
- **Depois (MangaInk):** `<SpeechBubble variant="yellow" tail="left">Dica aqui</SpeechBubble>` → balão com ponta triangular
- **Variantes:** `white`, `yellow`, `red`, `blue`
- **Tail:** `left`, `right`, `bottom`, `none`

### REGRA 08 — Divisores Viram `divide-dashed`

O Stitch usa `border-bottom: 1px solid #EEE`. O MangaInk usa linhas tracejadas grossas.

- **Antes (Stitch):** `<hr>` ou `border-bottom: 1px solid`
- **Depois (MangaInk):** `divide-y-2 divide-dashed divide-ink/30` no container pai
- **Exemplo:** `<ul className="divide-y-2 divide-dashed divide-ink/30">`

### REGRA 09 — Hover Ganha Lift Físico (`-translate-y-0.5`)

O Stitch usa `opacity: 0.8` ou `background-color` mais escuro no hover. O MangaInk faz o elemento "saltar" fisicamente.

- **Antes (Stitch):** `:hover { opacity: 0.85; }` ou `:hover { background: darker; }`
- **Depois (MangaInk):** `hover:-translate-y-0.5 transition-transform`
- **Elementos ativos:** `-translate-y-1` (StepIndicator ativo)
- **Sempre usar:** `transition-transform` (nunca `transition-opacity` ou `transition-colors`)

### REGRA 10 — Nada de Gradientes, Nada de Blur, Nada de Opacidade Desnecessária

Estes três são **PROIBIDOS** no estilo neo-brutalista do MangaInk:

| Proibido | Motivo | Exceção |
|----------|--------|---------|
| `linear-gradient()` / `radial-gradient()` (exceto halftone) | Quebra o estilo flat/sólido | `bg-halftone*` e `bg-comic-stripes` (texturas decorativas) |
| `box-shadow` com `blur-radius > 0` | Viola o princípio de sombra chapada | `animate-pulse-glow` (animação de loading) |
| `opacity < 1` em elementos principais | Cores devem ser sólidas e vibrantes | `opacity-25` no halftone overlay, `opacity-70` em texto secundário |
| `backdrop-blur` | Efeito vidro não combina com comic | Nenhuma |
| `bg-gradient-*` do Tailwind | Idem gradientes | Nenhuma |

---

## 5. Workflow de Integração

```
┌──────────────────────────────────────────────────────────────┐
│                    Fluxo Stitch → Código                      │
│                                                               │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Prompt   │───►│ Google Stitch│───►│ Design Exportado │   │
│  │ (PT-BR +  │    │  (gera HTML) │    │  (HTML/CSS/img)  │   │
│  │  brutal)  │    └──────────────┘    └────────┬─────────┘   │
│  └──────────┘                                   │              │
│                              ┌─────────────────▼──────────┐  │
│                              │   Brutalização (Guia §4)    │  │
│                              │  • 10 regras de conversão   │  │
│                              │  • Extrair layout/flow      │  │
│                              │  • Descartar estilo Stitch  │  │
│                              │  • Aplicar tokens comic     │  │
│                              └─────────────────┬──────────┘  │
│                                                │              │
│                              ┌─────────────────▼──────────┐  │
│                              │  Implementação Manual       │  │
│                              │  • React 19 + TypeScript    │  │
│                              │  • Tailwind v4 utility      │  │
│                              │  • shadcn/ui primitives     │  │
│                              │  • Comic components         │  │
│                              │  • Zod + react-hook-form    │  │
│                              └─────────────────┬──────────┘  │
│                                                │              │
│                              ┌─────────────────▼──────────┐  │
│                              │  Código em                   │  │
│                              │  src/components/            │  │
│                              │  src/routes/                │  │
│                              └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 5.1. Template de Prompt Neo-Brutalist

Use este template como ponto de partida para **todos** os prompts no Stitch. Ajuste a descrição funcional conforme o componente.

```
Estilo neo-brutalista comic book — NÃO é Material Design:

REGRAS VISUAIS OBRIGATORIAS:
- Bordas PRETAS GROSSAS (3px) em TODOS os elementos decorativos
- Sombras CHAPADAS offset 6px SEM blur (box-shadow: 6px 6px 0 0 #000)
- Fonte Bangers bold display para títulos, botões, labels e badges
- Fonte Inter para corpo de texto e parágrafos
- Cores sólidas vibrantes: vermelho #BD3126, amarelo #F7DE61, azul #2D68D1, creme #F9F8F3
- Fundo com pontinhos halftone (Ben-Day dots) estilo revista em quadrinhos
- Painéis levemente tortos (rotate 1-2 graus) alternando esquerda/direita
- Balões de fala com ponta triangular para mensagens
- Badges com formato irregular (não pills arredondados)

PROIBIDO:
- SEM gradientes de qualquer tipo
- SEM sombras com blur ou spread
- SEM bordas finas (<2px) ou cinzas
- SEM fontes genéricas (system-ui, Arial, Roboto)
- SEM cantos excessivamente arredondados (max 12px)
- SEM opacidade em elementos principais

[Descreva aqui a funcionalidade específica do componente/página]
```

### 5.2. Avaliação do Output — O Que Aproveitar e o Que Descartar

| Aspecto do Output Stitch | Aproveitar? | Ação |
|--------------------------|-------------|------|
| **Layout e posicionamento** (grid, flex, ordem) | ✅ SIM | Usar como referência de estrutura |
| **Hierarquia de informação** (tamanhos, pesos) | ✅ SIM | Mapear para escala tipográfica real (§6.3) |
| **Fluxo de navegação** (botões, links, tabs) | ✅ SIM | Substituir por shadcn/ui + comic |
| **Conteúdo textual** (labels, placeholders, CTAs) | ✅ SIM | Copiar textos, aplicar `font-display` |
| **Cores** (aproximação visual) | ⚠️ PARCIAL | Referência de tom; usar tokens oklch reais (§6.1) |
| **Bordas e sombras** | ❌ NÃO | Descartar; aplicar Regras 01-02 |
| **Fontes** | ❌ NÃO | Descartar; aplicar Regra 03 |
| **Estilo de badges/tooltips** | ❌ NÃO | Descartar; aplicar Regras 06-07 |
| **Animações e transições** | ❌ NÃO | Descartar; aplicar Regra 09 + catálogo §6.6 |

---

## 6. Design System do MangaInk — Referência Completa

### 6.1. Paleta de Cores

| Token CSS | Valor oklch | Hex (ref. Stitch) | Uso no Tailwind | Aplicação |
|-----------|-------------|-------------------|-----------------|-----------|
| `--comic-yellow` | `oklch(0.88 0.18 95)` | `#F7DE61` | `bg-comic-yellow` / `bg-secondary` | Header, fundos de destaque, badges, cards stats |
| `--comic-red` | `oklch(0.62 0.24 25)` | `#BD3126` | `bg-comic-red` / `bg-primary` | Ações primárias, CTA, header logo, badges de erro |
| `--comic-blue` | `oklch(0.5 0.22 260)` | `#2D68D1` | `bg-comic-blue` / `bg-accent` | Info, progresso, elementos concluídos |
| `--comic-cream` | `oklch(0.97 0.025 90)` | `#F9F8F3` | `bg-comic-cream` / `bg-background` | Fundo da página, hero section |
| `--comic-ink` | `oklch(0.15 0.02 260)` | `#0B0E17` | `border-ink` / `text-comic-ink` | **Todas as bordas e sombras**, texto principal |

**Mapeamento semântico shadcn/ui:**

| Token CSS | Variável shadcn | Efeito visual |
|-----------|-----------------|---------------|
| `--comic-cream` | `--background` | Fundo da página |
| `--comic-ink` | `--foreground`, `--border` | Todo texto e toda borda são preto chapado |
| `--comic-red` | `--primary`, `--destructive` | Ações principais = vermelho vibrante |
| `--comic-yellow` | `--secondary` | Destaques = amarelo vibrante |
| `--comic-blue` | `--accent`, `--ring` | Info/completado = azul |

**Dark mode:** `--primary` vira `--comic-yellow`, `--secondary` vira `--comic-red`, `--border` vira `--comic-cream`.

### 6.2. Intensidade Comic (3 níveis)

| Classe | `shadow-comic-sm` | `shadow-comic` (padrão) | `shadow-comic-lg` |
|--------|-------------------|------------------------|-------------------|
| `.comic-soft` | `2px 2px 0 0` | `3px 3px 0 0` | `5px 5px 0 0` |
| `.comic-normal` (default) | `3px 3px 0 0` | `6px 6px 0 0` | `10px 10px 0 0` |
| `.comic-loud` | `5px 5px 0 0` | `9px 9px 0 0` | `14px 14px 0 0` |

> **Todas as sombras têm `blur: 0, spread: 0`** — independente da intensidade. Apenas o offset muda.

Controle via:
- **`IntensityControl`** (`src/components/comic/IntensityControl.tsx`) — popover 3 opções discretas (`useComicIntensity`)
- **`ComicIntensitySlider`** (`src/components/theme/ComicIntensitySlider.tsx`) — slider contínuo 0–1 (`useTheme()`)
- **`ThemeSelector`** (`src/components/theme/ThemeSelector.tsx`) — grid de presets de cor + dark/light

### 6.3. Tipografia

| Token | Fonte | Fallback | Uso |
|-------|-------|----------|-----|
| `--font-display` | **Bangers** | Impact, system-ui | **Todo UI chrome:** headings, botões, labels, badges, nav, stats, `.font-display` |
| `--font-sans` | **Inter** | system-ui | Corpo de texto, descrições, parágrafos, placeholders |

`font-display` inclui `letter-spacing: 0.03em`. Headings (`h1`–`h4`) usam `font-display` + `letter-spacing: 0.02em` via `@layer base`. Labels e badges usam `uppercase`.

### 6.4. Sombras (Zero Blur — Âncora do Estilo)

| Utilitário | Valor exato | Uso |
|------------|------------|-----|
| `shadow-comic-sm` | `3px 3px 0 0 var(--comic-ink)` | Cards pequenos, badges, inputs, botões secundários |
| `shadow-comic` | `6px 6px 0 0 var(--comic-ink)` | Cards, painéis, botões primários (padrão) |
| `shadow-comic-lg` | `10px 10px 0 0 var(--comic-ink)` | Modais, hero sections, diálogos |

> **Regra de ouro:** Se qualquer `box-shadow` no código final tiver `blur > 0`, o componente **não está** seguindo o estilo neo-brutalista. A única exceção é `animate-pulse-glow` para loading.

### 6.5. Texturas de Fundo

| Utilitário | CSS | Tamanho | Uso |
|------------|-----|---------|-----|
| `bg-halftone` | `radial-gradient(comic-ink 1.2px, transparent 1.5px)` | `14px` | Fundo de página, hero, cards |
| `bg-halftone-dense` | `radial-gradient(comic-ink 1.5px, transparent 2px)` | `8px` | Áreas de destaque |
| `bg-halftone-red` | `radial-gradient(comic-red 2px, transparent 2.5px)` | `12px` | Badges, alertas |
| `bg-comic-stripes` | `repeating-linear-gradient(45deg, yellow 14px, cream 14px)` | `28px` | Headers, banners |

### 6.6. Catálogo de Animações

| Utilitário | Comportamento | Duração | Uso |
|------------|--------------|---------|-----|
| `animate-comic-pop` | `scale(0.85) rotate(-3deg)` → `1.08 rotate(2deg)` → `1 rotate(-2deg)` | 0.5s ease-out | Entrada de cards, modais, diálogos |
| `animate-comic-shake` | Oscilação ±2px + rotação ±1deg | 0.4s ease-in-out | Erro de formulário, feedback negativo |
| `animate-pulse-glow` | `box-shadow` azul pulsante (única exceção ao no-blur) | 2s infinite | Loading, progresso |
| `animate-slide-up` | `translateY(12px)` → normal | 0.3s ease-out | Listas, itens em cascata |
| `animate-bounce-in` | `scale(0.3)` → `1.05` → `0.95` → `1` | 0.5s ease-out | Badges especiais, notificações |

### 6.7. Bordas e Cantos

| Utilitário | Valor | Uso |
|------------|-------|-----|
| `border-ink` | `border-color: var(--comic-ink)` | **Toda borda** no sistema |
| `border-[3px]` | Espessura padrão (ComicPanel, modais, header) | Containers decorativos |
| `border-[2.5px]` | Espessura secundária (nav links, activity icons) | Elementos interativos menores |
| `border-2` | Espessura terciária (badges internos) | Detalhes |
| `rounded-xl` | `12px` (ComicPanel, cards) | Containers padrão |
| `rounded-3xl` | `24px` (SpeechBubble) | Balões de fala |
| `rounded-md` | `6px` (OnomatopoeiaBadge, botões, inputs) | Elementos compactos |
| `rounded-full` | Círculo (avatar, ícones, step circles) | Elementos circulares |

---

## 7. Tabela de Mapeamento: Stitch → shadcn/ui + Comic

### 7.1. Primitivas shadcn/ui (46 componentes em `src/components/ui/`)

| Elemento Stitch (HTML genérico) | Componente shadcn/ui | Import |
|--------------------------------|---------------------|--------|
| `<button>` | `<Button variant="..." size="...">` | `@/components/ui/button` |
| `<input type="text">` | `<Input>` | `@/components/ui/input` |
| `<textarea>` | `<Textarea>` | `@/components/ui/textarea` |
| `<select>` | `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>` | `@/components/ui/select` |
| `<input type="checkbox">` | `<Checkbox>` | `@/components/ui/checkbox` |
| `<input type="radio">` | `<RadioGroup>` + `<RadioGroupItem>` | `@/components/ui/radio-group` |
| `<input type="range">` | `<Slider>` | `@/components/ui/slider` |
| toggle switch | `<Switch>` | `@/components/ui/switch` |
| `<div class="card">` | `<Card>` + `<CardHeader>` + `<CardContent>` + `<CardFooter>` | `@/components/ui/card` |
| modal / `<div class="modal">` | `<Dialog>` + `<DialogTrigger>` + `<DialogContent>` + `<DialogHeader>` + `<DialogTitle>` + `<DialogDescription>` | `@/components/ui/dialog` |
| alerta de confirmação | `<AlertDialog>` + `<AlertDialogAction>` + `<AlertDialogCancel>` | `@/components/ui/alert-dialog` |
| drawer / slide panel | `<Drawer>` | `@/components/ui/drawer` |
| sheet / side panel | `<Sheet>` | `@/components/ui/sheet` |
| `<table>` | `<Table>` + `<TableHeader>` + `<TableBody>` + `<TableRow>` + `<TableCell>` | `@/components/ui/table` |
| tabs | `<Tabs>` + `<TabsList>` + `<TabsTrigger>` + `<TabsContent>` | `@/components/ui/tabs` |
| dropdown menu | `<DropdownMenu>` + `<DropdownMenuTrigger>` + `<DropdownMenuContent>` + `<DropdownMenuItem>` | `@/components/ui/dropdown-menu` |
| context menu (right-click) | `<ContextMenu>` | `@/components/ui/context-menu` |
| accordion / collapse | `<Accordion>` + `<AccordionItem>` + `<AccordionTrigger>` + `<AccordionContent>` | `@/components/ui/accordion` |
| `<nav>` | `<NavigationMenu>` | `@/components/ui/navigation-menu` |
| breadcrumb | `<Breadcrumb>` | `@/components/ui/breadcrumb` |
| sidebar | `<Sidebar>` + `<SidebarContent>` + `<SidebarGroup>` + `<SidebarMenuItem>` | `@/components/ui/sidebar` |
| progress bar | `<Progress value={n}>` | `@/components/ui/progress` |
| skeleton / loading | `<Skeleton>` | `@/components/ui/skeleton` |
| toast notification | `toast.success()`, `toast.error()` (sonner) | `@/components/ui/sonner` |
| tooltip | `<Tooltip>` + `<TooltipTrigger>` + `<TooltipContent>` | `@/components/ui/tooltip` |
| hover card | `<HoverCard>` | `@/components/ui/hover-card` |
| popover | `<Popover>` + `<PopoverTrigger>` + `<PopoverContent>` | `@/components/ui/popover` |
| command palette | `<Command>` + `<CommandInput>` + `<CommandList>` + `<CommandItem>` | `@/components/ui/command` |
| pagination | `<Pagination>` | `@/components/ui/pagination` |
| badge / tag | `<Badge variant="...">` | `@/components/ui/badge` |
| avatar | `<Avatar>` + `<AvatarImage>` + `<AvatarFallback>` | `@/components/ui/avatar` |
| separator / `<hr>` | `<Separator>` | `@/components/ui/separator` |
| label | `<Label>` | `@/components/ui/label` |
| carousel | `<Carousel>` + `<CarouselContent>` + `<CarouselItem>` | `@/components/ui/carousel` |
| chart | `<ChartContainer>` + Recharts | `@/components/ui/chart` |
| calendar / date picker | `<Calendar>` | `@/components/ui/calendar` |
| form wrapper | `<Form>` + react-hook-form + Zod | `@/components/ui/form` |
| toggle group | `<ToggleGroup>` + `<ToggleGroupItem>` | `@/components/ui/toggle-group` |
| menubar | `<Menubar>` | `@/components/ui/menubar` |
| scroll area | `<ScrollArea>` | `@/components/ui/scroll-area` |
| resizable panel | `<ResizablePanelGroup>` + `<ResizablePanel>` | `@/components/ui/resizable` |
| collapsible | `<Collapsible>` | `@/components/ui/collapsible` |
| aspect ratio | `<AspectRatio>` | `@/components/ui/aspect-ratio` |

### 7.2. Componentes Comic (`src/components/comic/`)

| Componente | Props | Quando usar |
|-----------|-------|-------------|
| **`<ComicPanel>`** | `tilt?: "left" \| "right" \| "none"` <br> `bg?: "card" \| "yellow" \| "red" \| "blue" \| "halftone"` <br> `padding?: "sm" \| "md" \| "lg"` <br> `as?: "div" \| "section" \| "article"` | Container padrão: borda `3px` preta, sombra offset, rotação opcional. Usar para TODO card, seção ou agrupamento visual. |
| **`<ComicHeader>`** | (self-contained, sem props) | Header global: logo, nav, dropdown jobs, dropdown usuário. Montado no `__root.tsx`. |
| **`<SpeechBubble>`** | `variant?: "white" \| "yellow" \| "red" \| "blue"` <br> `tail?: "left" \| "right" \| "bottom" \| "none"` | Substitui todo tooltip ou mensagem de destaque. Tail CSS triangular puro. |
| **`<OnomatopoeiaBadge>`** | `variant?: "yellow" \| "red" \| "blue"` <br> `size?: "sm" \| "md" \| "lg"` | Substitui todo badge/tag: `clip-path` jagged irregular, `-rotate-3`, `font-display`. |
| **`<StepIndicator>`** | `steps: { label: string; short: string }[]` <br> `current: number` <br> `visited: number` <br> `onJump: (index: number) => void` | Wizard 5 passos: grid `grid-cols-5`, círculo amarelo elevado = atual, azul = completo. |
| **`<IntensityControl>`** | `className?: string` | Popover 3 opções: Suave / Padrão / Exagerado. |
| **`<AnimatedCounter>`** | — | Números animados para estatísticas (dashboard e comic). |
| **`<ThemeToggle>`** | — | Botão light/dark (ícones Sun/Moon). |

### 7.3. Componentes de Funcionalidade (por domínio)

| Pasta | Componentes | Domínio |
|-------|-------------|---------|
| `dashboard/` | `StatsRow`, `ActivityFeed`, `LastReadCard`, `NextScheduleBanner`, `NextScheduleCard`, `AnimatedCounter` | Dashboard inicial |
| `biblioteca/` | `CollectionManager`, `FilterBar`, `SearchBar`, `MangaCover`, `SeriesActionsMenu`, `DeleteConfirmDialog`, `ReconvertDialog`, `RenameSeriesDialog`, `FavoriteButton`, `ReadButton`, `TabCapitulos`, `TabConversoes`, `TabDetalhes` | Biblioteca de mangás |
| `wizard/` | `ComparisonSlider`, `PresetSelector`, `SavePresetDialog`, `ConversionFieldGroup`, `ConversionFieldRenderer` | Wizard de conversão |
| `agendamentos/` | `Timeline` | Agendamentos |
| `perfil/` | `Achievements`, `MonthlyChart`, `TopReadings` | Perfil do usuário |
| `reader/` | `ReaderToolbar` | Leitor de mangá |
| `fontes/` | `SuggestSourceForm` | Sugestão de fontes |
| `notifications/` | `ComicToast`, `NotificationBell` | Notificações |
| `onboarding/` | `OnboardingOverlay` | Onboarding |
| `theme/` | `ThemeSelector`, `ThemeToggle`, `ComicIntensitySlider` | Tema/intensidade |
| `auth/` | `RequireAuth` | Guard de autenticação |

---

## 8. Rotas e Páginas — Alvos de Design com Stitch

| Rota | Arquivo | Descrição | Componentes-chave |
|------|---------|-----------|-------------------|
| `/` | `routes/index.tsx` | Dashboard: stats, feed, agendamento | `StatsRow`, `ActivityFeed`, `NextScheduleBanner`, `LastReadCard` |
| `/login` | `routes/login.tsx` | Login (email/senha) | `Form`, `Input`, `Button`, `Card` |
| `/cadastro` | `routes/cadastro.tsx` | Registro | `Form`, `Input`, `Button`, `Card` |
| `/wizard` | `routes/wizard.tsx` | Wizard 5 passos: URL → Preview → Caps → Config → Confirm | `StepIndicator`, `ComicPanel`, `PresetSelector` |
| `/biblioteca` | `routes/biblioteca.index.tsx` | Grid/lista de obras com capas | `CollectionManager`, `FilterBar`, `SearchBar`, `MangaCover` |
| `/biblioteca/:sourceId` | `routes/biblioteca.$sourceId.tsx` | Detalhe: Capítulos, Conversões, Detalhes | `TabCapitulos`, `TabConversoes`, `TabDetalhes` |
| `/biblioteca/reader/:conversionId` | `routes/biblioteca.reader.$conversionId.tsx` | Leitor multi-formato | `ReaderToolbar` |
| `/biblioteca/converter/:jobId` | `routes/biblioteca.converter.$jobId.tsx` | Progresso de conversão SSE | `Progress`, SSE status |
| `/perfil` | `routes/perfil.tsx` | Perfil: stats, gráfico, conquistas | `Achievements`, `MonthlyChart`, `TopReadings` |
| `/agendamentos` | `routes/agendamentos.tsx` | Timeline de assinaturas | `Timeline` |
| `/fontes` | `routes/fontes.tsx` | Sugestão de fontes | `SuggestSourceForm` |
| `/configuracoes` | `routes/configuracoes.tsx` | Tema, intensidade, prefs | `ThemeSelector`, `ComicIntensitySlider` |

---

## 9. Checklist de Adaptação Stitch → Código

Antes de iniciar a implementação a partir de um design do Stitch:

### Layout e Conteúdo
- [ ] **Prompt** em PT-BR com template neo-brutalist (§5.1) — inclui proibições (SEM gradientes, SEM blur)
- [ ] **Layout validado**: grid, flex, single-column? Mapeado para Tailwind responsivo
- [ ] **Hierarquia de informação** extraída (o que é título, subtítulo, corpo, ação)
- [ ] **Conteúdo textual** em português brasileiro

### Brutalização (Guia §4)
- [ ] **REGRA 01**: Toda borda decorativa → `border-[3px] border-ink`
- [ ] **REGRA 02**: Toda sombra → `shadow-comic-*` (blur = 0, spread = 0)
- [ ] **REGRA 03**: Toda fonte display → `font-display` (Bangers); corpo → `font-sans` (Inter)
- [ ] **REGRA 04**: Fundos sólidos → `bg-halftone`, `bg-halftone-dense` ou `bg-comic-stripes`
- [ ] **REGRA 05**: Containers → `<ComicPanel tilt="left"|"right">` alternado
- [ ] **REGRA 06**: Badges/tags → `<OnomatopoeiaBadge>` com clip-path jagged
- [ ] **REGRA 07**: Tooltips/mensagens → `<SpeechBubble>` com tail CSS
- [ ] **REGRA 08**: Divisores → `divide-y-2 divide-dashed divide-ink/30`
- [ ] **REGRA 09**: Hover → `hover:-translate-y-0.5 transition-transform` (lift físico)
- [ ] **REGRA 10**: Verificar proibições — zero gradientes, zero blur, zero opacidade desnecessária

### Componentes e Código
- [ ] **shadcn/ui identificados**: cada elemento HTML mapeado (§7.1)
- [ ] **Comic components aplicados**: `<ComicPanel>`, `<SpeechBubble>`, `<OnomatopoeiaBadge>`
- [ ] **Animações de entrada**: `animate-comic-pop`, `animate-slide-up`, `animate-bounce-in`
- [ ] **Formulários**: Zod + react-hook-form + `<Form>` (shadcn/ui)
- [ ] **Modo escuro**: `dark:` prefix (variáveis CSS já mapeiam automaticamente)
- [ ] **Intensidade comic**: `.comic-soft` / `.comic-normal` / `.comic-loud` no root
- [ ] **Responsivo**: breakpoints `sm:`, `md:`, `lg:` mobile-first
- [ ] **Acessibilidade**: `aria-label` em ícones, `sr-only` em labels, `role` em regiões
- [ ] **`cn()` para merge**: classes condicionais via `cn()` de `@/lib/utils`
- [ ] **Sem HTML/CSS do Stitch**: todo markup reescrito em JSX/TSX

---

## 10. Exemplos Práticos (com Antes/Depois da Brutalização)

### 10.1. Card de Estatística do Dashboard

**O que o Stitch gera (antes da brutalização):**
> Card com `border-radius: 16px`, `box-shadow: 0 4px 12px rgba(0,0,0,0.1)`, `font-family: "Inter"`, fundo amarelo pastel `#FFF3CD`, padding `24px`, ícone e número alinhados horizontalmente.

**Prompt para Stitch:**
> "Card de estatística neo-brutalista: fundo amarelo #F7DE61 vibrante, borda preta grossa 3px, sombra chapada offset 6px SEM blur. Ícone de livro preto à esquerda, número grande '142' em Bangers bold à direita. Label 'Mangás Convertidos' em Bangers bold uppercase. Cantos 12px. Fundo com pontinhos halftone. Tamanho ~280px."

**Código pós-brutalização:**
```tsx
import { ComicPanel } from "@/components/comic/ComicPanel"
import { BookOpen } from "lucide-react"

export function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <ComicPanel bg="yellow" tilt="left" padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <BookOpen className="h-6 w-6 text-comic-ink" />
        <span className="font-display text-3xl tabular-nums">{value}</span>
      </div>
      <span className="font-display text-sm uppercase tracking-wider text-comic-ink/70">
        {label}
      </span>
    </ComicPanel>
  )
}
```

### 10.2. Modal de Confirmação

**O que o Stitch gera (antes):**
> Modal com `border-radius: 20px`, `box-shadow: 0 8px 32px rgba(0,0,0,0.12)`, overlay com `backdrop-blur`, botões com `border-radius: 999px`, fonte system-ui, sem borda visível.

**Transformações aplicadas:**
- Overlay `backdrop-blur` → removido (Regra 10)
- `box-shadow` com blur 32px → `shadow-comic-lg` (Regra 02)
- `border-radius: 20px` → `rounded-xl` + `border-[3px] border-ink` (Regra 01)
- Botões pill → `rounded-md` com `border-ink` (Regra 01)
- Fonte genérica → `font-display` (Regra 03)

**Código pós-brutalização:**
```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle } from "lucide-react"

export function ConfirmDialog({ open, onOpenChange, onConfirm, title, description }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-[3px] border-ink shadow-comic-lg rounded-xl">
        <AlertDialogHeader>
          <AlertTriangle className="h-10 w-10 text-comic-red mx-auto mb-2" />
          <AlertDialogTitle className="font-display text-comic-red text-2xl text-center">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-center gap-4 mt-4">
          <AlertDialogCancel className="font-display border-[2.5px] border-ink shadow-comic-sm">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="font-display bg-comic-red text-primary-foreground shadow-comic-sm hover:-translate-y-0.5 transition-transform"
          >
            Confirmar
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### 10.3. Página de Login

**O que o Stitch gera (antes):**
> Tela centralizada com fundo gradiente suave, card com `box-shadow: 0 4px 24px rgba(0,0,0,0.08)`, inputs com `border: 1px solid #D1D5DB`, botão com `border-radius: 999px` e `background: linear-gradient(...)`, links em azul padrão, sem textura.

**Transformações aplicadas:**
- Fundo gradiente → `bg-comic-cream bg-halftone` (Regras 04, 10)
- Sombra com blur → `shadow-comic-lg` (Regra 02)
- Inputs `1px gray` → `border-ink shadow-comic-sm` (Regras 01, 02)
- Botão gradiente → `bg-comic-yellow border-ink shadow-comic` (Regras 01, 10)
- Link azul → `text-comic-red font-display` (Regra 03)
- Fonte título → `font-display` (Regra 03)
- Labels → `font-display` (Regra 03)

**Código pós-brutalização:**
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Mail, Lock } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(4, "Mínimo 4 caracteres"),
})

export function LoginPage() {
  const form = useForm({ resolver: zodResolver(loginSchema) })

  return (
    <div className="min-h-screen bg-comic-cream bg-halftone flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[3px] border-ink shadow-comic-lg rounded-2xl animate-comic-pop">
        <CardHeader className="text-center pb-2">
          <BookOpen className="h-14 w-14 text-comic-red mx-auto mb-3" />
          <CardTitle className="font-display text-3xl text-comic-ink">
            Bem-vindo de Volta!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-display">Email</FormLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-comic-ink/40" />
                    <Input {...field} className="pl-10 border-ink shadow-comic-sm" placeholder="seu@email.com" />
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-display">Senha</FormLabel>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-comic-ink/40" />
                    <Input {...field} type="password" className="pl-10 border-ink shadow-comic-sm" placeholder="••••••••" />
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <Button
                type="submit"
                className="w-full font-display text-lg bg-comic-yellow text-comic-ink border-[3px] border-ink shadow-comic hover:-translate-y-0.5 transition-transform h-12"
              >
                Entrar
              </Button>
            </form>
          </Form>
          <p className="text-center mt-6 text-sm text-comic-ink/60">
            Não tem conta?{" "}
            <Link to="/cadastro" className="font-display text-comic-red hover:underline">
              Cadastre-se
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 11. Decisões Técnicas

### 11.1. Por que adaptação manual em vez de script de conversão?

| Critério | Script automático | Adaptação manual |
|----------|-------------------|------------------|
| Precisão do estilo neo-brutalista | Baixa (CSS genérico) | Alta (tokens reais + 10 regras) |
| Manutenibilidade | Frágil (muda com versão do Stitch) | Robusta (documentada) |
| Qualidade final | Baixa-média | Alta |
| Componentes reutilizáveis | Não | Sim (segue padrão do projeto) |
| Responsividade | Não | Sim (Tailwind mobile-first) |
| Acessibilidade | Não | Sim (Radix a11y built-in) |

**Decisão:** Adaptação manual. O overhead é compensado pela necessidade de aplicar as 10 regras de brutalização, que exigem julgamento humano.

### 11.2. Por que Stitch + manual, e não Figma + código?

| Critério | Stitch | Figma |
|----------|--------|-------|
| Velocidade de iteração | Segundos (texto) | Minutos/horas (drag) |
| Curva de aprendizado | Zero (linguagem natural) | Alta (ferramenta complexa) |
| Output programático | HTML/CSS | Design specs manuais |
| Colaboração em tempo real | Limitada | Nativa |
| Prototipação interativa | Não | Sim |

**Decisão:** Stitch para exploração rápida individual e validação de layout. Figma opcional para colaboração em equipe.

### 11.3. Por que prompt em português?

O Stitch gera labels, placeholders e CTAs baseados no idioma do prompt. Prompts em inglês geram textos em inglês que exigem tradução. Além disso, o contexto semântico em português produz designs mais próximos da realidade da aplicação.

### 11.4. Por que tokens oklch e não hex?

`oklch` é o formato nativo do Tailwind v4 e oferece percepção de cor mais uniforme que hex/rgb. Os valores hex gerados pelo Stitch (`#BD3126`, `#F7DE61`, etc.) são convertidos para seus equivalentes oklch no código.

### 11.5. Dark mode automático

Não é necessário gerar versões escuras no Stitch. As variáveis CSS do Tailwind v4 já mapeiam automaticamente quando `.dark` está presente no `<html>`: `--primary` troca de `--comic-red` para `--comic-yellow`, `--border` troca de `--comic-ink` para `--comic-cream`, etc.

### 11.6. Por que zero blur nas sombras?

O blur em sombras (`box-shadow: 0 4px 12px`) é o marcador visual mais forte de Material Design e estilos "polidos". O neo-brutalist comic depende de sombras 100% chapadas (`blur: 0, spread: 0`) para criar o efeito de "papel recortado" característico de quadrinhos impressos. Esta é a **regra mais importante** de todo o design system.

---

## 12. Anti-Padrões — Red Flags do Stitch

Estes são os **sinais de alerta** no output do Stitch que indicam que o design **NÃO** está seguindo o estilo neo-brutalista. Se encontrar qualquer um destes, a brutalização (§4) é obrigatória.

### 12.1. Lista de Red Flags

| # | Red Flag no Stitch | Por que é problema | Correção |
|---|-------------------|-------------------|----------|
| 1 | `box-shadow` com **3º valor > 0** (blur) | Viola Regra 02 — sombra NÃO é chapada | `shadow-comic` = `6px 6px 0 0` |
| 2 | `border: 1px solid #E0E0E0` ou cinza | Viola Regra 01 — borda fina e sem cor ink | `border-[3px] border-ink` |
| 3 | `font-family: "Anybody"` ou system-ui em headlines | Viola Regra 03 — fonte display errada | `font-display` (Bangers) |
| 4 | `background: linear-gradient(...)` ou `bg-gradient-*` | Viola Regra 10 — gradiente proibido | Cor sólida + halftone |
| 5 | `backdrop-filter: blur(...)` | Viola Regra 10 — efeito vidro incompatível | Remover; usar `bg-card` sólido |
| 6 | `border-radius: 999px` (pill) em badges/tags | Viola Regra 06 — badges devem ser irregulares | `<OnomatopoeiaBadge>` com `clip-path: polygon(...)` |
| 7 | `opacity: 0.8` em hover de elementos principais | Viola Regra 09 — hover deve ser lift físico | `hover:-translate-y-0.5 transition-transform` |
| 8 | Tooltip como `<div>` retangular com `box-shadow` | Viola Regra 07 — tooltip deve ser balão | `<SpeechBubble tail="left">` |
| 9 | `border-bottom: 1px solid #EEE` como divider | Viola Regra 08 — divider deve ser dashed | `divide-y-2 divide-dashed divide-ink/30` |
| 10 | Cores pastel/dessaturadas (ex: `#FEF3C7` em vez de `#F7DE61`) | Viola saturação — cores devem ser vibrantes | Tokens oklch com chroma > 0.18 |
| 11 | Cards sem borda visível ou com `border: none` | Viola Regra 01 — TODO card precisa de borda preta | `<ComicPanel>` |
| 12 | Layout perfeitamente alinhado, sem tilt | Viola Regra 05 — painéis devem ter rotação sutil | `tilt="left"|"right"` alternado |

### 12.2. Teste Rápido de Conformidade

Para qualquer design do Stitch, faça estas 3 perguntas:

1. **"As sombras têm blur?"** — Se sim, ❌ não é neo-brutalista.
2. **"As bordas são pretas e grossas?"** — Se não, ❌ não é neo-brutalista.
3. **"Os títulos usam fonte comic (Bangers)?"** — Se não, ❌ não é neo-brutalista.

Se qualquer resposta for ❌, aplique o Guia de Brutalização (§4) antes de codificar.

---

## 13. Limitações Conhecidas

### 13.1. Limitações do Stitch

| Limitação | Impacto no estilo neo-brutalista | Mitigação |
|-----------|----------------------------------|-----------|
| Stitch gera HTML/CSS genérico, não JSX React | Todo markup é reescrito | Tabelas de mapeamento (§7) |
| Viés para Material Design (sombras com blur, bordas finas) | **Output parece "dashboard genérico"** | Guia de Brutalização (§4) + template de prompt agressivo (§5.1) |
| Não reproduz `clip-path` irregular (OnomatopoeiaBadge) | Badges sempre aparecem como pills | `<OnomatopoeiaBadge>` adicionado no código |
| Não gera tails CSS triangulares (SpeechBubble) | Tooltips sempre são caixas retangulares | `<SpeechBubble>` adicionado no código |
| Sem suporte a Tailwind v4 ou tokens oklch | Cores em hex, não oklch | Conversão manual; hex do Stitch são referência |
| Sem shadcn/ui ou Radix primitives | Elementos padrão HTML | Substituir por shadcn/ui (§7.1) |
| Sem responsividade (viewport fixa) | Layout mobile precisa ser inferido | Tailwind mobile-first manual |
| Sem animações comic (`animate-comic-pop`, etc.) | Animações adicionadas no código | Catálogo de animações (§6.6) |
| Sem modo escuro | Apenas light mode | Variáveis CSS mapeiam dark mode automaticamente |
| Sem texturas halftone CSS | Fundos sempre são cor sólida | `bg-halftone` aplicado no código |
| Sem estado React (hooks, context) | Comportamento dinâmico manual | Seguir padrões: `useAuth`, `useBiblioteca` |
| Sem validação de formulários | Zod + react-hook-form no código | Padrão `<Form>` do shadcn/ui |

### 13.2. Limitações da Abordagem

| Limitação | Descrição |
|-----------|-----------|
| **Brutalização é manual** | As 10 regras exigem julgamento humano — um script não consegue decidir onde aplicar tilt ou qual variante de SpeechBubble usar |
| **Templates de prompt não são à prova de bala** | Mesmo com o template neo-brutalist (§5.1), o Stitch pode ignorar restrições e gerar Material Design. Iteração pode ser necessária |
| **Dark mode não é validado no Stitch** | O design gerado é sempre light mode. Confiar no mapeamento automático das variáveis CSS |
| **Texturas halftone são CSS puro** | O Stitch não consegue reproduzir `radial-gradient` com precisão. Validar texturas apenas no código |

---

## 14. Diagrama de Contexto

```
┌──────────────────────────────────────────────────────────────────┐
│                     MangaInk Agent — UI Layer                     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Google Stitch (externo)                      │ │
│  │  Prompt PT-BR brutal → Geração IA → Design (HTML/CSS/img)    │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                              │                                     │
│                              │ Layout + fluxo (não estilo!)        │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Brutalização + Adaptação Manual                  │ │
│  │                                                               │ │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │ 10 Regras│  │ shadcn/ui │  │ Comic    │  │ Form       │  │ │
│  │  │ (§4)     │  │ primitives│  │ panels   │  │ validation │  │ │
│  │  │ Brutal.  │  │ (§7.1)    │  │ (§7.2)   │  │ (Zod+RHF)  │  │ │
│  │  └──────────┘  └───────────┘  └──────────┘  └────────────┘  │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Código de Produção                         │ │
│  │                                                               │ │
│  │  src/routes/*.tsx          ← Páginas (file-based routing)    │ │
│  │  src/components/comic/*    ← Componentes temáticos            │ │
│  │  src/components/ui/*       ← Primitivas shadcn/ui (46)       │ │
│  │  src/components/dashboard/*│ ← Dashboard (StatsRow, etc.)     │ │
│  │  src/components/biblioteca/*│ ← Biblioteca (Collection, etc.) │ │
│  │  src/components/wizard/*   │ ← Wizard (Preset, Slider)       │ │
│  │  src/components/perfil/*   │ ← Perfil (Achievements, Chart)  │ │
│  │  src/components/reader/*   │ ← Leitor (Toolbar)              │ │
│  │  src/components/theme/*    │ ← Tema (Selector, Slider)       │ │
│  │  src/components/notifications/*│ ← Toast, Bell               │ │
│  │  src/components/onboarding/*│ ← Overlay                      │ │
│  │  src/components/fontes/*   │ ← SuggestSourceForm             │ │
│  │  src/components/agendamentos/*│ ← Timeline                   │ │
│  │  src/hooks/*               ← Lógica de estado                │ │
│  │  src/lib/api.ts            ← API client                      │ │
│  │  src/styles.css            ← Tema @theme inline              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 15. Próximos Passos

- [ ] Criar templates de prompt reutilizáveis para cada tipo de componente (card, modal, form, table, page)
- [ ] Documentar exemplos de Stitch → brutalização → código para todas as 12 rotas
- [ ] Criar script de scaffolding que gera boilerplate com `border-[3px] border-ink shadow-comic` por padrão
- [ ] Avaliar integração com Figma para colaboração em equipe (complementar ao Stitch)
- [ ] Definir checklist visual de "aprovação neo-brutalista" para revisão de designs
- [ ] Criar biblioteca de "prompts de referência" no repositório para designs comuns
- [ ] Explorar exportação de tokens do Stitch para automatizar parcialmente o mapeamento de cores

---

> **Aviso final:** O Google Stitch é uma ferramenta de **exploração de layout e fluxo**. Nenhum HTML/CSS gerado por ele deve ser usado diretamente no código do MangaInk Agent. O estilo neo-brutalista comic — bordas `3px` pretas, sombras `0 0` sem blur, fonte Bangers, halftone dots, painéis com tilt, onomatopeias e speech bubbles — é **100% responsabilidade do desenvolvedor**. Use as 10 Regras de Brutalização (§4) como seu checklist de conversão.
