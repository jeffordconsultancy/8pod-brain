FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --no-audit --no-fund

# Copy the rest of the app
COPY . .

# Generate Prisma client and build Next.js
RUN npx prisma generate && npm run build

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Push schema and start
CMD npx prisma db push --accept-data-loss && npm start
