# Pareto Principle (80/20 Rule) Guidelines

*Project: Nosferatu Woods Cat Tournament*

The **Pareto Principle** posits that roughly 80% of outcomes stem from 20% of inputs. In this application, engineering efforts, performance optimizations, and UX priorities should align with where users derive the vast majority of value.

---

## 1. Product & Feature Impact (Where 80% of User Value Lives)

### The Vital 20% (Core Value Drivers)
Focus the majority of design polish, testing, and latency optimization here:
- **Head-to-Head Arena (`TournamentArena`)**: The core voting loop. Fast image delivery, instantaneous tap/click response, keyboard shortcuts, and clear victory animations account for >80% of active user engagement.
- **Elo Ratings & Leaderboard (`elo.ts`, `Dashboard`)**: Rating updates provide immediate feedback and meaningful progression, driving replayability.
- **Contender Showcase (`NameSelector`, `DriftWall`)**: Visual browsing, category exploration, and contender selection before entering the tournament.

### The Supporting 80% (Keep Lean & Maintainable)
Avoid over-engineering these secondary surfaces:
- **Admin & Moderation Tools**: Bulk locks, hides, and admin controls are needed for data hygiene but rarely touched by regular players.
- **Auxiliary Visual Effects (`FluidGlass`, `Iridescence`)**: Keep these lightweight and progressive; degrade gracefully on lower-end mobile devices without blocking interaction.
- **Complex Bracket Variations**: The single-elimination and fast head-to-head formats cover the vast majority of user sessions.

---

## 2. Performance & Asset Delivery

- **Images**: Contender portraits represent ~80% of the network payload. Optimize thumbnail dimensions, leverage modern formats (`webp`), and lazy-load offscreen tiles.
- **Three.js & Canvas Effects**: WebGL shaders consume the majority of GPU/battery resources. Ensure RAF (requestAnimationFrame) loops pause when offscreen or when reduced-motion preferences are active.
- **Bundle Trimming**: Keep runtime dependencies focused; avoid importing large libraries for single utility functions.

---

## 3. Code Maintenance & Testing Priorities

- **Algorithmic Correctness**: Write exhaustive tests for the matchmaking engine (`tournamentEngine.ts`), Elo rating calculations (`elo.ts`), and local state persistence (`tournamentStorage.ts`). Bugs here break tournament integrity.
- **Resilience**: Ensure offline fallback (IndexedDB / localStorage) functions seamlessly when external services (e.g., Supabase) are disconnected.
- **Biome & Strict Typing**: Keep CI passes fast with automated linting and zero-error type checking.
