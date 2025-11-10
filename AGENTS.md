# Repository Guidelines

## Getting Oriented
- Always read `docs/planning/development-plan.md` first. It documents the active milestones, TODO checklists, reference assets, and the “TODO 찾고 진행하는 방법” process for discovering pending work.
- Follow the discovery process documented there: scan the plan, search code for `TODO`/`FIXME`, review recent issues/commits, sanity-check the running app, then update the plan with any new findings.

## Project Structure & Module Organization
The repository hosts a Vite-based Tiptap demo. Place runtime code under `src/`: the entry point (`src/main.tsx`) wires providers, editor configuration lives in `src/editor/`, and visual components use `src/components/`. Shared helpers belong in `src/lib/`. Global styles stay in `src/styles/`. Keep static HTML and images in `public/`. End-to-end smoke tests live under `tests/` with mirrors of the `src/` folder names, and utility scripts (scaffolding, data seeding) go into `scripts/`.

## Build, Test, and Development Commands
- `npm install` - install dependencies; always rerun after pulling lockfile changes.
- `npm run dev` - start the Vite dev server on http://localhost:5173 with hot reload.
- `npm run build` - create a production bundle in `dist/`; run before publishing sample output.
- `npm run preview` - serve the built bundle locally for QA.
- `npm run test` - execute Vitest unit/integration suites headlessly.
- `npm run lint` / `npm run format` - run ESLint and Prettier; required before opening a PR.

## Coding Style & Naming Conventions
Use TypeScript with strict mode enabled. Prefer 2-space indentation, trailing commas, and single quotes. Name React components in `PascalCase`, hooks in `useCamelCase`, and utility modules in `camelCase`. Keep editor extensions and schemas under `src/editor/extensions/*` with filenames mirroring the extension name. Run `npm run lint` and `npm run format` to enforce ESLint + Prettier.

## Testing Guidelines
Write Vitest specs alongside features under `tests/<feature>/<name>.spec.ts`. Focus on editor behaviors (schema rules, commands, menu visibility). When adding regression tests, include a brief comment referencing the issue. Aim for high coverage on collaborative logic; document skipped tests with a TODO pointing to a follow-up.

## Critical Development Process
- Treat `docs/planning/development-plan.md` as the source of truth. Before implementing anything, run the app, confirm the current behavior, and update the plan if it has drifted from reality.
- Follow the documented execution order (Step 0 → S1…S27). Ask “what’s next?” only after verifying Step 0 (editor stability) is complete.
- Use strict TDD: add/update tests first, implement the change, ensure all tests pass, then open MCP Chrome DevTools and manually verify the UI flow before committing.
- Every change must include automated tests plus manual verification notes; only commit/push once tests succeed and MCP checks confirm the behavior.
- FE and BE live in the same monorepo (Node.js backend + Vite frontend). Keep shared types/helpers single-sourced and respect the FE/BE workset pairings in the plan.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `chore:`). Group atomic changes per commit and avoid mixing build output. PRs should link to tracking tickets, summarize editor UX changes, and attach before/after screenshots or GIFs when UI shifts. Include checklist items for lint, tests, and manual verification of core editor flows.
