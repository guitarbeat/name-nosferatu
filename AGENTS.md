# AGENTS.md

## Cursor Cloud specific instructions

### Runtime requirements

- **Node.js 24.x** — selected via `.nvmrc` and `engines` in `package.json`. Run `nvm install` and `nvm use` so local and CI builds match Vercel's active-LTS runtime.
- **pnpm 10.27.0** — pinned via `packageManager` in `package.json`. Install it with Corepack or `npm install -g pnpm@10.27.0` under Node 24.

### Key commands

All commands use `pnpm` from the project root:

| Action | Command |
|--------|---------|
| Install deps | `pnpm install` |
| Dev server (port 5000) | `pnpm dev` |
| Run tests | `pnpm test` |
| Lint (maintenance + biome + tsc) | `pnpm run lint` |
| Build | `pnpm run build` |
| Auto-fix formatting | `pnpm run fix` |

### Environment variables

Copy `.env.example` to `.env` at the project root. The app gracefully degrades when Supabase credentials are empty (runs in offline mode), so the dev server and tests work without them. Full E2E features (tournament voting, auth, leaderboard data) require valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Gotchas

- All Biome linting and TypeScript checks pass cleanly with 0 errors and 0 warnings (`pnpm run lint` or `npm run lint`).
- Vite config is at `config/vite.config.ts` (not root). All config lives under `config/`.
- The dev server binds to `0.0.0.0:3000` (or `0.0.0.0:5000` locally) with `strictPort: false`.
- Tests use jsdom environment and run via Vitest (`config/vitest.config.ts`).
- There are no git hooks, Makefiles, or devcontainer configs — just `pnpm install` and go.

---

## Code Guidelines & Standards

### 1. Architecture & Modular Structure

- **Layered Structure**:
  - `src/app/`: Application bootstrap, routes (`HomeRoute`, `AdminRoute`), providers, and root layout shell (`App.tsx`, `main.tsx`, `Providers.tsx`).
  - `src/features/`: Feature modules (`tournament/`, `dashboard/`). Keep domain logic, components, and hooks encapsulated within their respective feature folder.
  - `src/shared/`: Cross-cutting concerns including shared UI blocks, layout components, custom hooks, API clients, and utilities (`src/shared/lib/`, `src/shared/components/`, `src/shared/api.ts`).
  - `src/store/`: Central application Zustand store, state slices, and storage persistence.
- **Avoid Fragmented Barrel Files**: Prefer direct imports to actual component/utility definitions rather than creating artificial intermediary barrel files.

### 2. TypeScript & Type Safety

- **Strict Type Checking**: Maintain zero-error compilation with `tsc --project config/tsconfig.json --noEmit`.
- **Typing Discipline**: Avoid `any`; use typed interfaces, union types, or `unknown` with runtime type narrowing.
- **Explicit Imports**: Group and sort imports automatically via Biome (`npm run fix`). Do not destructure within type imports.

### 3. Formatting & Linting (Biome)

- **Formatting Rules**:
  - Indentation: Tab indentation.
  - Line Width: 100 characters.
  - Quotes: Double quotes (`"`).
  - Control Flow: Always use explicit block statements (`{ ... }`) for `if`, `else`, `for`, and `while` loops.
- **Import Organization**: Automatically organized alphabetically and categorized via `biome check --write`.
- **Accessibility & ARIA Enforcement**:
  - ARIA attributes and roles are verified via Biome's `a11y` rules (`useAriaPropsForRole`, `useValidAriaProps`, `useValidAriaValues`, `useAltText`, `useHeadingContent`, `useAriaActivedescendantWithTabindex`).
- **Validation**:
  - Run `npm run lint` before committing changes to verify Biome lint rules, accessibility rules, and TypeScript type checks.
  - Use `npm run fix` to auto-resolve formatting and import order discrepancies.

### 4. React & Hook Best Practices

- **Functional Components**: Write pure, functional components using hooks.
- **Hook Dependency Integrity**:
  - Ensure dependency arrays in `useEffect`, `useCallback`, and `useMemo` are exhaustive and reference stable identifiers or primitives.
  - Avoid stale closures by reading direct state or using functional updates where appropriate.
  - Never trigger state mutations inside render passes.
- **Motion & Accessibility**:
  - Animations must respect `reducedMotion: "user"` via Framer Motion / Motion.
  - Interactive elements must provide accessible labels (`aria-label`, `title`), keyboard focus rings, and touch targets of at least 44px on mobile viewports.

### 5. Styling & Design Tokens

- **Tailwind Utility Classes**: Use Tailwind utility classes directly for spacing, layout, typography, and responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`).
- **Class Merging**: Combine conditional class names using the `cn()` helper (`clsx` + `tailwind-merge`) from `@/shared/lib/utils`.
- **Consistency**: Use semantic design tokens and surface classes (`themeSurfaces`) defined in `src/shared/lib/uiUtils.ts`. Avoid hardcoded arbitrary color values when semantic theme variables are available.

### 6. Error Handling & State Management

- **Graceful Degradation**: When optional external services (such as Supabase) are unavailable, ensure the application operates seamlessly in offline/local-storage mode.
- **Error Boundaries**: Wrap major view boundaries and async components in `<ErrorBoundary>`.
- **Global Error Management**: Use `ErrorManager` from `@/shared/lib/utils` for capturing unhandled promise rejections and emitting user-facing toast alerts.

### 7. Testing Standards

- **Framework**: Vitest with React Testing Library and jsdom (`config/vitest.config.ts`).
- **Co-location**: Keep test files alongside the code they test (`*.test.ts` or `*.test.tsx`).
- **Coverage Focus**: Cover critical tournament engine logic, Elo calculation algorithms, storage adapters, and interactive component lifecycles.

### 8. Mechanical Artifact Lifecycle Enforcement

- **Automated Gate**: `npm run lint` mechanically validates syntax, types, unused files, duplicate exports, package dependencies, and folder/naming conventions (`biome` + `tsc` + `knip` + `scripts/validate-structure.ts`).
- **Pre-Commit Enforcement**: Git commits are validated via `.githooks/pre-commit` (or `npm run precommit`) using `scripts/validate-structure.ts --staged` to reject non-compliant files before staging/committing.
- **Naming Patterns**:
  - React Components (`.tsx`): PascalCase (e.g. `TournamentArena.tsx`).
  - Modules & Utilities (`.ts`): camelCase (e.g. `tournamentEngine.ts`, `storage.ts`, `hooks.ts`, `types.ts`).
  - Feature Folders: lowercase / kebab-case (e.g. `src/features/tournament/`, `src/features/dashboard/`).
- **Zero Orphaned Files**: New components and utilities must be connected to an active consumer immediately. Unreferenced files cause `knip` to exit with an error.
- **Export Discipline**: Use named exports exclusively for components and utility functions. Never export duplicate default and named signatures from the same module.
- **Strict Layering**: Code must reside within `src/app/`, `src/features/`, `src/shared/`, `src/store/`, or `src/assets/`. Arbitrary root folders (e.g. `src/components/`) are prohibited and will fail lifecycle checks.

