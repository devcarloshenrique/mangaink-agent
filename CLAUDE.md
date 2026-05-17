# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: MangaForge

A self-hosted web app that converts manga from online sources into Kindle-compatible formats (EPUB, MOBI, CBZ, KFX) and sends them to your Kindle device. The UI is in **Brazilian Portuguese** and uses a comic book pop-art design system.

## Tech Stack

- **React 19** + **TypeScript** (strict)
- **Vite 7** (build tool)
- **TanStack Router** (file-based routing via `createFileRoute`)
- **TanStack Query** (available but not heavily used yet)
- **Tailwind CSS v4** with custom comic book theme tokens
- **Radix UI** primitives (shadcn/ui pattern — components in `src/components/ui/`)
- **Zod** (available for validation)
- **react-hook-form** + `@hookform/resolvers` (form handling)
- **sonner** (toasts)

## Commands

```bash
npm run dev        # Start dev server at http://localhost:5173
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint
npm run format     # Prettier
```

## Routing (TanStack Router)

File-based routing with `createFileRoute`. Route files live in `src/routes/`:

| File                              | Route                                              |
| --------------------------------- | -------------------------------------------------- |
| `src/routes/__root.tsx`           | Root layout (wraps all routes with `AuthProvider`) |
| `src/routes/index.tsx`            | `/` — Dashboard (requires auth)                    |
| `src/routes/login.tsx`            | `/login` — Login page                              |
| `src/routes/wizard.tsx`           | `/wizard` — 5-step manga conversion wizard         |
| `src/routes/biblioteca.tsx`       | `/biblioteca` — Library of converted manga         |
| `src/routes/biblioteca.$slug.tsx` | `/biblioteca/:slug` — Library detail               |
| `src/routes/agendamentos.tsx`     | `/agendamentos` — Scheduled subscriptions          |
| `src/routes/configuracoes.tsx`    | `/configuracoes` — Settings                        |
| `src/routes/fontes.tsx`           | `/fontes` — Supported sources (not yet created)    |

**Important:** The auto-generated `src/routeTree.gen.ts` must not be edited manually. Run `npm run dev` to regenerate it when routes change.

## Authentication (Mock Mode)

Auth is fully mocked. `src/hooks/useAuth.tsx` provides a `AuthProvider` context with a hardcoded user (`admin` / `admin@kindle.com`). `RequireAuth` in `src/components/auth/RequireAuth.tsx` renders children unconditionally. Login accepts any credentials. When replacing with real auth, update both files and the `AuthProvider` context type.

## Architecture

### Route Structure

- `__root.tsx` wraps everything in `<AuthProvider>` and renders `<Outlet />`
- All protected routes wrap their component in `<RequireAuth>`
- Routes use `createFileRoute("/path")({ component: Page })` pattern
- Navigation uses `useNavigate({ to: "/path" })` and `<Link to="/path">`

### Components

- `src/components/ui/` — shadcn/ui components (Radix-based, styled with Tailwind)
- `src/components/comic/` — Domain-specific comic UI: `ComicPanel`, `ComicHeader`, `SpeechBubble`, `OnomatopoeiaBadge`, `StepIndicator`, `MockPage`
- `src/components/auth/` — `RequireAuth` guard

### Key Domain Logic

- `src/lib/kindle-presets.ts` — Kindle device profiles, output formats (EPUB/MOBI/CBZ/KFX), and image presets
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)

### Wizard Flow (`/wizard`)

5-step wizard: Origin URL → Chapter Selection → Cover Assignment → Device/Format Config → Delivery. All data fetching is mocked via `mockFetchSeries()`. State is held in a single `WizardData` object with step validation via `canNext`.

## Design System

Defined in `src/styles.css` using Tailwind v4 `@theme inline`:

- **Colors:** `--comic-yellow`, `--comic-red`, `--comic-blue`, `--comic-cream`, `--comic-ink` (all oklch)
- **Fonts:** `--font-display` (Bangers), `--font-sans` (Inter)
- **Shadows:** `--shadow-comic-sm` (3px), `--shadow-comic` (6px), `--shadow-comic-lg` (10px) — all hard offset shadows
- **Utilities:** `.font-display`, `.border-ink`, `.shadow-comic-sm`, `.bg-halftone`, `.animate-comic-pop`, `.animate-comic-shake`
- **Dark mode:** Supported via `.dark` class with swapped palette

## Path Aliases

`@/` maps to `src/` (configured via `vite-tsconfig-paths` and `tsconfig.json`).

## Conventions

- All UI text is in **Brazilian Portuguese**
- Use `cn()` for conditional class merging
- Use `ComicPanel` for card-like containers with comic styling (supports `tilt`, `bg`, `padding` props)
- Use `sonner` for toasts via `toast.success()` / `toast.error()`
- The `Toaster` component must be mounted in each page (import from `sonner`)
- Mock data is used throughout — no real backend integration yet
