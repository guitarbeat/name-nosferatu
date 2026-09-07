# Artifact Lifecycle & Mechanical Enforcement Policy

*Project: Nosferatu Woods Cat Tournament*

## 1. Background & Root Cause Analysis

Historically, the repository experienced repeated organizational drift and maintenance friction despite well-documented architectural guidelines in `AGENTS.md`. Applying the **Root Cause Analysis (RCA)** protocol (Toyota 5 Whys and Barrier Analysis) revealed:

- **The Core Flaw**: Architectural rules were documented as *administrative controls* (guidelines for developers/agents to remember) rather than *mechanical barriers* (automated gates that halt CI/lint when violated).
- **Entropy Accumulation**: When refactoring components, duplicate files (e.g., `src/components/ui/MagicToggle.tsx` vs. `src/shared/components/UIBlocks.tsx`) and dual exports (`export default Component` alongside `export function Component`) accumulated invisibly because `biome` and `tsc` only verify syntax and types, not lifecycle deadness.

---

## 2. The Four Mechanical Barriers (Poka-Yoke)

| Failure Mode | Administrative Rule (Failed) | Mechanical Barrier (Active) |
|---|---|---|
| **Orphaned / Zombie Files** | "Delete unused files after refactoring" | `knip --include files` automatically fails lint if any file has zero active consumers |
| **Duplicate & Shadow Exports** | "Use named exports" | `knip --include duplicates` fails if a module exports both default and named signatures |
| **Orphaned Dependencies** | "Keep dependencies clean" | `knip --dependencies` fails if unlisted or unneeded packages exist in `package.json` |
| **Rogue Architectural Folders** | "Only use app/, features/, shared/, store/" | Boundary checks and knip project roots enforce layer containment |

---

## 3. Toolchain & Commands

Mechanical lifecycle checks are integrated directly into standard validation commands:

| Command | Action | Checks Performed |
|---|---|---|
| `npm run lint` | Full primary gate | **Biome** (syntax, formatting, ARIA/a11y) + **TSC** + **Knip** (dead code & duplicates) + **Structure Validator** |
| `npm run lint:fast` | Fast syntax/type gate | Biome (including a11y) + TSC |
| `npm run lint:lifecycle` | Lifecycle analysis | Knip standalone (unreferenced files, duplicate exports, dependencies) |
| `npm run lint:structure` / `npm run check:structure` | Structure & Naming gate | `scripts/validate-structure.ts` scans layer containment and naming conventions |
| `npm run precommit` | Pre-commit validation | `scripts/validate-structure.ts --staged` validates staged files prior to commit |
| `npm run check` | Full pre-push validation | Runs complete `npm run lint` suite |

---

## 4. Developer & Agent Rules

1. **Delete, Don't Deprecate**: When replacing a component or utility, delete the old implementation and its tests in the same commit.
2. **Named Exports Exclusively**: Components in `src/shared/components/` and `src/features/` must export named functions (`export function MyComponent`). Do not provide fallback default exports.
3. **Naming Patterns**:
   - React Components (`.tsx`): PascalCase (e.g. `TournamentArena.tsx`).
   - Modules & Utilities (`.ts`): camelCase (e.g. `tournamentEngine.ts`, `storage.ts`).
   - Feature Folders: lowercase / kebab-case (e.g. `src/features/tournament/`).
4. **Git Pre-Commit Hook**:
   - Automatically installed via `npm run prepare` (configured to `.githooks/pre-commit`).
   - Runs `scripts/validate-structure.ts --staged` on every `git commit`. If any staged file breaks layer or naming rules, the commit is rejected immediately.
5. **Layered Placement**:
   - `src/app/`: Bootstrap, routes, shell layout
   - `src/features/`: Domain modules (`tournament/`, `dashboard/`)
   - `src/shared/`: Reusable UI blocks, utilities, api clients
   - `src/store/`: Zustand state slices and storage adapters
   - `src/assets/`: Static assets (logos, images, svgs)
   - Any other top-level directories in `src/` (such as `src/components/` or `src/utils/`) are prohibited.
