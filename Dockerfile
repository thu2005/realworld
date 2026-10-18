# syntax=docker/dockerfile:1
FROM node:14.21.3-bullseye-slim

WORKDIR /app

# Install native dependencies required for node modules (sqlite3, python, build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./

# Clean npm cache and install dependencies per CI_INTEGRATION_CONTRACT
RUN npm cache clean --force && npm install --no-audit --no-fund

COPY . .

# Build Next.js application
RUN npm run build-dev

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/tags || exit 1

CMD ["npm", "start"]
