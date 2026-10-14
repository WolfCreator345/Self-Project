# NFSU Library — production image.
# Build:  docker build -t nfsu-library .
# Run:    docker run -d -p 3000:3000 --env-file .env.production -v nfsu-data:/data nfsu-library
# First run only (adds categories, newspaper links, sample books):
#         docker exec <container> npm run db:seed
FROM node:22-slim

# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL="file:/data/library.db"

# The SQLite database lives on this volume so it survives redeploys.
VOLUME ["/data"]
EXPOSE 3000

# Applies any pending migrations, then starts the server.
CMD ["npm", "run", "start:prod"]
