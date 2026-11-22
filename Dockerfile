FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml ./
# Só as dependências de produção: o PGlite (banco local e dos testes) fica fora da imagem.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --chown=node:node api ./api
COPY --chown=node:node db ./db
COPY --chown=node:node p2 ./p2
RUN mkdir -p /app/.runtime /app/backups && chown node:node /app/.runtime /app/backups
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4184
USER node
EXPOSE 4184
CMD ["node", "api/server.mjs"]
