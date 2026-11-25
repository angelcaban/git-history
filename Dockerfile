# Runs the Express server and serves the built client. The build context is the
# staging/ directory that ./build.sh assembles:
#
#   ./build.sh
#   docker build -f Dockerfile -t git-history-page staging
#   docker run --rm -p 3000:3000 -v git-history-repos:/data/repos git-history-page

# Pinned to an exact patch release; bump it deliberately.
FROM node:26.12.1-alpine

# The server shells out to git to clone and query repositories; openssh-client is
# for ssh:// and git@host:path URLs. tini forwards signals so `docker stop` is quick.
# No production dependency has native code, so musl libc needs no rebuilds.
RUN apk add --no-cache git openssh-client ca-certificates tini

WORKDIR /app

ENV NODE_ENV=production \
  PORT=3000 \
  CLIENT_DIST_DIR=/app/public \
  REPO_CACHE_DIR=/data/repos

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY dist ./dist
COPY public ./public

# Bare clones of browsed repositories; mount a volume to keep them across restarts.
RUN mkdir -p /data/repos && chown node:node /data/repos
VOLUME /data/repos

USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/index.js"]
