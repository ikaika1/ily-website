# Repository Guidelines

## Project Structure & Module Organization
- Root static site: HTML/CSS/JS at `/` (e.g., `index.html`, `gallery.html`, `js/`, `images/`).
- Staking UI app: Next.js + TypeScript in `solana-staking-ui/` with `app/`, `components/`, `utils/`, `context/`, `hooks/`.
- Config: `solana-staking-ui/eslint.config.mjs`, `.prettierrc`, `tailwind.config.ts`, `wrangler.toml`, `.env` (use `.env.exemple` as a template).

## Build, Test, and Development Commands
- Root helpers
  - `npm run dev:static` — serve static site at `http://localhost:3000`.
  - `npm run dev:staking` — run the staking UI dev server.
  - `npm run install:all` — install root and `solana-staking-ui` deps.
- Staking UI (inside `solana-staking-ui/`)
  - `npm run dev` — Next.js dev server (port 3000).
  - `npm run build` — production build.
  - `npm run start` — start built app.
  - `npm run lint` / `npm run format` — lint and Prettier format.
- Deploy (Cloudflare Pages/Workers)
  - Build with Next + `@cloudflare/next-on-pages`, then `wrangler pages deploy .vercel/output` (see `wrangler.toml`).

## Coding Style & Naming Conventions
- Language: TypeScript/React (Next.js 15), Tailwind CSS.
- Formatting: Prettier (`.prettierrc`), run `npm run format` before PRs.
- Linting: ESLint `next/core-web-vitals` (`npm run lint`). Fix warnings where feasible.
- Indentation: 2 spaces; semi-colons optional by Prettier.
- Files: components `PascalCase.tsx` (e.g., `WalletConnectButton.tsx`); hooks/utilities `camelCase.ts`; constants `UPPER_SNAKE_CASE`.
- Imports: prefer absolute aliases used in app (e.g., `@/utils/...`).

## Testing Guidelines
- No formal test suite yet. Verify manually:
  - Wallet connect/disconnect, balance fetch (`/api/balance`).
  - Stake account fetch/generate/confirm endpoints.
  - Main staking flow (`components/stake/StakeButton.tsx`).
- Include repro steps in PRs; add lightweight unit tests if introducing new pure utilities.

## Commit & Pull Request Guidelines
- Commits: short, imperative English subject; optional scope (e.g., `stake: fix fee buffer`).
- PRs must include:
  - Summary, motivation, and linked issues.
  - Screenshots/GIFs for UI changes.
  - Setup notes for `.env` changes; do not commit secrets.
  - Passing lint/format; avoid committing build artifacts.

## Security & Configuration Tips
- Keep `.env` out of VCS; follow `.env.exemple`.
- Validate RPC endpoints and `NEXT_PUBLIC_*` usage; avoid logging sensitive values.
