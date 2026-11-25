# git-history-page

A self-hosted web UI for browsing git repositories and digging through their history. It is a faster replacement for Bitbucket's annotation (blame) view.

Enter a repository URL and the app shows its file tree. Click a file to see it read-only, with every line annotated by the commit that last changed it. From there you can step back through a line's history:

- **The commit sha** opens the file as it was in that commit, scrolled to and highlighting those lines.
- **↶** opens the file as it was just *before* that commit, at the lines it replaced.
- **The browser's Back button** returns to the lines you came from.

Everything about the current view is kept in the URL (`?repo=…&ref=…&path=…&lines=…`), so you can bookmark or share any view.

The server clones each repository once into a cache and re-fetches it at most once per refresh interval, so browsing doesn't wait on the git host.

## Repository layout

| Path | What it is |
| --- | --- |
| `client/` | React + Vite single-page app (TypeScript, Tailwind CSS) |
| `server/` | Node + Express server (TypeScript). It exposes a GraphQL API over WebSocket at `/graphql`, runs `git` against cached clones, and serves the built client at `/`. |
| `build.sh` | Tests and builds both packages, then builds the Docker image |
| `Dockerfile` | Runtime image (Node on Alpine, with git) |
| `docker-compose.yml` | Runs the built image |

## Building

Requirements: Node.js 26, npm, and Docker.

```sh
./build.sh
```

The script:

1. Installs dependencies in `client/` and `server/` if they are missing.
2. Runs lint, type checks, and tests for both packages. Skip this with `./build.sh --skip-tests`.
3. Builds the client into `client/dist` and the server into `server/dist`.
4. Assembles `staging/` from the server's `package.json` and lockfile, the compiled server in `dist/`, and the built client in `public/`.
5. Builds the Docker image `git-history-page:latest` with `staging/` as the build context.

## Running the image

### With Docker Compose

```sh
docker compose up -d
```

Then open <http://localhost:3000>. Cloned repositories are kept in the `repos` volume, so they survive restarts. `docker compose down -v` deletes the volume.

The settings below can be set in your shell or in a `.env` file next to `docker-compose.yml`. `HOST_PORT` changes the published port:

```sh
HOST_PORT=8080 ALLOWED_GIT_HOSTS=github.com,bitbucket.org docker compose up -d
```

### With `docker run`

```sh
docker run -d --name git-history -p 3000:3000 \
  -v git-history-repos:/data/repos \
  -e ALLOWED_GIT_HOSTS=github.com \
  git-history-page
```

### Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `ALLOWED_GIT_HOSTS` | *(any host)* | Comma-separated hosts that repository URLs may point at. Set this when the server is reachable by others. |
| `REPO_REFRESH_SECONDS` | `60` | How long a cached clone counts as fresh before the next request fetches updates. |
| `GIT_TIMEOUT_SECONDS` | `120` | Kills a git process that produces no output for this long. |
| `MAX_FILE_BYTES` | `10485760` | Largest file (10 MiB) the server will return or annotate. |
| `ALLOW_FILE_URLS` | `false` | Accept `file://` URLs, which read repositories from the container's own filesystem. Enable only if you mount repositories into the container. |
| `PORT` | `3000` | Port the server listens on inside the container. |
| `REPO_CACHE_DIR` | `/data/repos` | Where clones are cached. Mount a volume here. |
| `CLIENT_DIST_DIR` | `/app/public` | Built client to serve at `/`. Set by the image; you shouldn't need to change it. |

### Repository URLs

The app accepts `https://`, `http://`, `ssh://`, `git://`, and scp-style `git@host:path` URLs.

The container has no git credentials, so out of the box it can only clone public repositories. To browse a local repository, mount it read-only and enable `file://` URLs:

```sh
docker run -d -p 3000:3000 -e ALLOW_FILE_URLS=true \
  -v /path/to/repo:/repos/my-repo:ro git-history-page
```

Then open `file:///repos/my-repo`.

## Development

Run the server and the client in two terminals:

```sh
cd server && npm install && npm run dev     # http://localhost:3000
cd client && npm install && npm run dev     # http://localhost:5173, proxies /graphql to the server
```

Each package has `npm test`, plus `npm run lint` (client) or `npm run typecheck` (server). See [CLAUDE.md](CLAUDE.md) for architecture notes.

## License

MIT. See [LICENSE](LICENSE).
