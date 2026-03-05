FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies (skip postinstall prisma generate, we do it separately)
RUN npm install --no-audit --no-fund --ignore-scripts

# Copy the rest of the app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Push schema and start in dev mode (faster, no build step)
CMD sh -c "npx prisma db push --skip-generate && npm run dev"
