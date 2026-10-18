# syntax=docker/dockerfile:1
FROM node:14.21.3-bullseye

WORKDIR /app

COPY package.json ./

# Clean npm cache and install dependencies per CI_INTEGRATION_CONTRACT
RUN npm cache clean --force && npm install --no-audit --no-fund --ignore-scripts && (npm rebuild sqlite3 || true)

# Copy application files and directories explicitly to avoid copying sensitive data
COPY api ./api
COPY bin ./bin
COPY front ./front
COPY models ./models
COPY pages ./pages
COPY public ./public
COPY app.js auth.js db.ts front.ts lib.js next.config.js next-env.d.ts style.scss tsconfig.json ./

# Build Next.js application and set user permissions in merged RUN layer
RUN npm run build-dev && chown -R node:node /app

USER node

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=development

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/tags || exit 1

CMD ["npm", "start"]
