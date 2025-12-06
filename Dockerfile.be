FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Generate prisma client
RUN npx prisma generate
# Build backend
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
# Install dependencies (including dev for prisma generate, though optimized builds would prune this)
RUN npm ci
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/prisma ./prisma

# Generate prisma client for runtime
RUN npx prisma generate

EXPOSE 9920
CMD ["node", "server/dist/app.js"]
