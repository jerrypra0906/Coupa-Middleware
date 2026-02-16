FROM node:18-alpine AS base

WORKDIR /usr/src/app

# Install dependencies first (leverages Docker layer cache)
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src

# Default environment
ENV NODE_ENV=production \
    PORT=6001

# Expose API port
EXPOSE 6001

# Run migrations then start server
CMD [ "sh", "-c", "node src/migrations/runMigrations.js && node src/index.js" ]


