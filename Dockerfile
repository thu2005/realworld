# syntax=docker/dockerfile:1
FROM node:14.21.3-bullseye-slim

WORKDIR /app

# Install native dependencies required for node modules (sqlite3, python, build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    g++ \
    git \
    make \
    python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./

# Clean npm cache and install dependencies per CI_INTEGRATION_CONTRACT
RUN npm cache clean --force && npm install --no-audit --no-fund

# Copy application files and directories explicitly to avoid copying sensitive data
COPY api ./api
COPY bin ./bin
COPY front ./front
COPY models ./models
COPY pages ./pages
COPY public ./public
COPY app.js auth.js db.ts front.ts lib.js next.config.js next-env.d.ts style.scss tsconfig.json ./

# Build Next.js application
RUN npm run build-dev

# Use non-root user for security
RUN chown -R node:node /app
USER node

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/tags || exit 1

CMD ["npm", "start"]
