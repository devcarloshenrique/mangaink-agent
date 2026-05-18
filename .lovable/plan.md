# Tema + Dashboard mais vivo

Implementar duas melhorias visuais (mockadas) no MangaForge POC.

## 1. Tema (header)

**Toggle dark/light**
- Novo botão no `ComicHeader` (ao lado do botão de Downloads), ícone Sun/Moon.
- Hook `useTheme` em `src/hooks/useTheme.tsx` — persiste em `localStorage` (`mangaforge-theme`), aplica/remove classe `.dark` no `<html>`.
- Provider montado em `__root.tsx` para evitar flash inicial.

**Intensidade comic**
- Slider (3 níveis: Suave / Padrão / Exagerado) dentro de um Popover acionado por um botão no header (ícone Sparkles ou Settings2).
- Hook `useComicIntensity` — persiste em `localStorage`, define classe no `<html>` (`comic-soft` | `comic-normal` | `comic-loud`).
- Em `src/styles.css`: redefinir `--shadow-comic-sm/comic/comic-lg` por classe pai:
  - `comic-soft`: 2px / 3px / 5px
  - `comic-normal`: 3px / 6px / 10px (atual)
  - `comic-loud`: 5px / 9px / 14px
- Toggle e slider visíveis também no menu da conta para mobile.

## 2. Dashboard mais vivo (`/`)

Reorganizar `src/routes/index.tsx` em uma grade que adiciona, acima dos tiles atuais:

**Widget "Última leitura"** (`ComicPanel` destacado, ocupa 2 colunas em desktop)
- Capa mockada (usar emoji/placeholder colorido), título "Berserk", "Cap. 42 de 87".
- Barra de progresso comic-style (border-ink, fill `comic-red`) com percentual.
- Botão "Continuar lendo" → `/biblioteca/berserk`.

**Stats animados** (3 mini-cards lado a lado)
- "Total convertido": 127 capítulos
- "MB economizados": 842 MB
- "Enviados ao Kindle (mai/26)": 18
- Cada número anima de 0 até o valor final com `requestAnimationFrame` (~800ms easeOut). Componente reutilizável `AnimatedCounter`.

**Próximo agendamento em destaque** (faixa comic)
- "One Piece cap. 1109 chega em ~3 dias" com ícone Calendar, fundo `comic-blue`, badge "EM BREVE".
- Link → `/agendamentos`.

**Feed de atividade recente** (substitui o "Últimas conversões" atual, mas mantém a lista)
- 5 entradas mockadas com ícone (✓ enviado, ↻ convertido, 📅 agendado, ⚠ erro).
- Texto: "Berserk Vol.12 enviado pro Kindle", timestamp relativo ("há 2h").
- Cores por tipo de evento.

## Detalhes técnicos

- Dados 100% mockados em `src/lib/dashboard-mock.ts` (lastRead, stats, activity, nextSchedule).
- Sem novas dependências. Animação de contador via `useEffect` + `requestAnimationFrame`.
- Persistência via `localStorage` apenas (sem backend).
- Manter design system: tokens existentes, `ComicPanel`, `OnomatopoeiaBadge`, `SpeechBubble`.

## Arquivos

**Novos**
- `src/hooks/useTheme.tsx`
- `src/hooks/useComicIntensity.tsx`
- `src/components/comic/ThemeToggle.tsx`
- `src/components/comic/IntensityControl.tsx`
- `src/components/comic/AnimatedCounter.tsx`
- `src/components/dashboard/LastReadCard.tsx`
- `src/components/dashboard/StatsRow.tsx`
- `src/components/dashboard/NextScheduleBanner.tsx`
- `src/components/dashboard/ActivityFeed.tsx`
- `src/lib/dashboard-mock.ts`

**Editados**
- `src/routes/__root.tsx` — montar `ThemeProvider` + `ComicIntensityProvider`.
- `src/components/comic/Header.tsx` — adicionar ThemeToggle + IntensityControl.
- `src/routes/index.tsx` — nova composição do dashboard.
- `src/styles.css` — variantes de sombra por classe `comic-soft/normal/loud`.
