# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

A self-hosted web UI for browsing git repositories and drilling into history. It covers a single file line by line (blame/annotate, then clicking through to earlier revisions of a line) or a whole repository file by file. It is meant to be a faster replacement for Bitbucket's slow annotation view. The app ships as a single Docker image.

## Layout

Two independent npm packages (no root `package.json` or workspaces). Run commands from inside each directory.

- `server/`: Node + Express 5 server in TypeScript with a GraphQL API served over WebSocket. It uses `simple-git` to open and query git repositories on disk (log, blame, show, ls-tree, and so on). `src/app.ts` exports `createApp(config)`, which builds the Express app and serves the built client when `CLIENT_DIST_DIR` is set. `src/graphql/server.ts` attaches the GraphQL WebSocket server to an HTTP server. `src/index.ts` only wires the two together and calls `listen`.
- `client/`: React 19 + Vite 8 SPA in TypeScript. It shows the repo file tree, file contents with commit annotations, and history navigation, and calls the server API for all git data. Styled with Tailwind CSS v4.
- `build.sh`: runs lint, typecheck, and tests (skip them with `--skip-tests`), builds both packages, assembles `staging/`, and builds the Docker image from it. That directory holds the server's `package.json`/lockfile, `dist/` (the compiled server), and `public/` (the built client).
- `Dockerfile`: builds the image from `staging/` as the build context (`docker build -f Dockerfile -t git-history-page staging`). It uses `node:26.x-alpine` with git, openssh-client, and tini, installs production deps with `npm ci --omit=dev`, sets `CLIENT_DIST_DIR=/app/public` and `REPO_CACHE_DIR=/data/repos` (a volume), and runs as the `node` user. `docker-compose.yml` runs that locally built image with a named `repos` volume and a `wget` healthcheck. It passes the server settings through from the environment or `.env`, and `HOST_PORT` (default 3000) picks the published port.

## Current state

The whole API is GraphQL over WebSocket (graphql-ws protocol) at `ws://<host>/graphql`. There is no HTTP GraphQL endpoint and there are no REST routes. The schema, `src/graphql/schema.graphql`, is the source of truth. `Query.repository(url, ref)` returns a `Repository` with `tree`, `files`, `file`, `blame`, `fileHistory`, and `lineHistory` fields.

- **Request flow:** graphql-ws owns the socket protocol. Its `execute` hook runs each operation through Apollo Server's `executeOperation`, so Apollo's `formatError` masks unexpected errors as `INTERNAL_SERVER_ERROR`. Because Apollo returns already-formatted errors, an `onNext` hook sends them as they are.
- **Errors:** errors meant for clients are `ApiError`s (`src/errors.ts`), each carrying an `extensions.code`.
- **Unused package:** `graphql-subscriptions` is installed, but there are no subscriptions yet.
- **Resolver types:** `npm run codegen` generates them from the schema into `src/graphql/__generated__/resolvers-types.ts` (configured in `codegen.ts`). Mappers point each GraphQL type at the existing structure in `src/git/` or `src/graphql/models.ts`. Re-run it after every schema change and don't edit the generated file.
- **File history:** `fileLog` in `repository.ts` uses `git log --parents --date-order -- <paths>`, not `--follow`. `--follow` doesn't rewrite parents and drops merges, so its output can't be drawn as a graph. Renames are followed by re-running the log with the old path added whenever the oldest commit renamed the file in (found with `diff-tree -M`).
- **Git layer:** `src/git/repository.ts` holds transport-independent git operations. `src/git/repoCache.ts` bare-clones each requested URL into a cache directory and re-fetches it at most once per refresh interval. The output parsers in `src/git/` are pure functions with their own unit tests.
- **Configuration:** env vars read in `src/config.ts`: `REPO_CACHE_DIR`, `REPO_REFRESH_SECONDS`, `GIT_TIMEOUT_SECONDS`, `ALLOWED_GIT_HOSTS`, `ALLOW_FILE_URLS`, `MAX_FILE_BYTES`, and `CLIENT_DIST_DIR`. `attachGraphQL(httpServer, config)` takes an explicit config, and tests use it with `file://` fixture repos.

**Client:** the SPA takes a repository URL, shows its file tree in a left pane, and shows the selected file in the main pane, in two tabs. **Code** shows the file with blame annotations. **History** (`?view=history`) shows the commits that changed the file as a lane graph, laid out by `src/commitGraph.ts` and drawn as one SVG per table row. Following any commit link records where browsing started as `basePath`/`baseRef` (`src/historyBase.ts`, passed to links through context). History lists commits from that point and highlights the version the Code tab shows. Picking a file in the tree or **Back to latest** clears it. The open repo, revision, file, and highlighted lines live in the query string (`?repo=…&ref=…&path=…&lines=12-20`, via `src/useLocationParams.ts`). The sha in a blame annotation links to that commit's version of the file, scrolled to the lines' `originalLineNumber`s. A second link (↶) opens the file in the commit's parent (`BlameCommit.previous`). Clicking it calls `lineHistory` and reads the old side of that commit's hunks (`src/parentLines.ts`) to find where the lines were. Before leaving, it records the clicked lines in the current history entry, so Back returns to them. `src/api/client.ts` wraps one lazy `graphql-ws` client, and `src/api/useQuery.ts` is the data-fetching hook. Query strings and their hand-written result types are in `src/api/queries.ts`, with no client codegen. The tree is built client-side from `Repository.files` (`src/tree.ts`). The blame query passes the commit sha the tree resolved to, so the file and the tree always match. In development, Vite proxies `/graphql` (WebSocket) to `localhost:3000`. In production, set `CLIENT_DIST_DIR` to `client/dist`. The server then sends `index.html` at `/` (with `no-cache`) and serves the hashed `assets/` as immutable. It refuses to start if the directory has no `index.html`. When the variable is unset, `/` returns a 404 explaining how to set it.

simple-git runs in strict mode. Git gets only an allowlisted environment (`passthroughEnv` in `repoCache.ts`), because strict mode rejects inherited variables such as `GIT_EDITOR`. Any new `GIT_*` variable must be added to `allowEnvironment` there.

## Commands

Client (`cd client`):
- `npm run dev`: Vite dev server with HMR
- `npm run build`: `tsc -b` type-check, then `vite build` to `client/dist`
- `npm run lint`: ESLint (flat config in `eslint.config.js`)
- `npm run preview`: serve the production build
- `npm test`: run Vitest once; `npm run test:watch` for watch mode
- Single test: `npx vitest run src/App.test.tsx`, or filter by name with `npx vitest run -t "binary"`

Server (`cd server`):
- `npm run dev`: `tsx watch src/index.ts` (listens on `PORT`, default 3000)
- `npm run codegen`: regenerate GraphQL resolver types from `src/graphql/schema.graphql`
- `npm run typecheck`: `tsc --noEmit`
- `npm test`: run Jest; `npm run test:watch` for watch mode
- Single test: `npx jest src/app.test.ts`, or filter by name with `npx jest -t "client page"`

- `npm run build`: compile `src/` (minus tests) to `dist/` with `tsconfig.build.json` and copy `schema.graphql` next to `dist/graphql/server.js`
- `npm start`: run `dist/index.js`

## Testing

- **Client:** Vitest, configured in the `test` block of `vite.config.ts`, uses the jsdom environment with React Testing Library and `@testing-library/user-event`. `src/test/setup.ts` registers the jest-dom matchers (`toBeInTheDocument`, etc.) and cleans up after each test. Globals are off, so import `describe`/`it`/`expect` from `vitest`. Test files (`*.test.tsx`) live next to their sources, and `npm run build` type-checks them too.
- **Server:** Jest with `@swc/jest` as the TypeScript transform (`jest.config.js`), chosen over ts-jest so tests don't depend on the TypeScript compiler API (the server is on TypeScript 7). SWC only strips types, so run `npm run typecheck` to catch type errors. GraphQL tests (`src/graphql/server.test.ts`) start a real server on an ephemeral port and query it with a `graphql-ws` client. `supertest` covers the plain Express app. Source imports use `.js` extensions (NodeNext style), and `moduleNameMapper` maps them back to `.ts` for Jest. Test files are `src/**/*.test.ts`.

## Gotchas

- **Server tsconfig** is mostly the untouched `tsc --init` output, used for type-checking (`noEmit` is not set, so don't run a bare `tsc`). `"types"` is `["node", "jest"]`: add any other ambient type package there or it won't load. Production builds use `tsconfig.build.json`, which extends it. `package.json` says `"type": "commonjs"`, so the ESM-syntax sources (`module: nodenext`) compile to CommonJS. `server.ts` relies on that through `__dirname`.
- **Strict server options**: `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on, so array/record indexing yields `T | undefined` and optional properties cannot be assigned `undefined` explicitly.
- **Client compiler**: the React Compiler runs through `@rolldown/plugin-babel` in `vite.config.ts`, so manual `useMemo`/`useCallback` is usually unnecessary. `verbatimModuleSyntax` and `erasableSyntaxOnly` are enabled: use `import type` for type-only imports, and avoid `enum`s and parameter properties.
- **Different TypeScript versions**: client uses `~6.0`, server `^7.0`.
- **Sandbox and ports:** server tests bind ephemeral localhost ports (`sandbox.network.allowLocalBinding` is enabled in `.claude/settings.local.json`). `tsx` also opens a Unix-socket IPC pipe that the sandbox blocks, so `npm run dev` fails with `listen EPERM ... .pipe` inside it. Both are environment issues, not code failures.
- **Tailwind v4 setup:** Tailwind runs through the `@tailwindcss/vite` plugin and is loaded by `@import "tailwindcss";` at the top of `client/src/index.css`. There is no `tailwind.config.js` or PostCSS config: customize the theme in CSS with `@theme`. The leftover Vite template CSS in `index.css` and `App.css` isn't in a cascade layer, so it overrides Tailwind utilities on the same elements (e.g. the fixed-width, centered `#root`). Remove it as template pages get replaced.
