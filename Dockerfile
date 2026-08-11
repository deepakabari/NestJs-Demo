# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the NestJS application
RUN npm run build

# Stage 2: Setup production environment
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Only copy the production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the built artifacts from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# The app listens on port 3000
EXPOSE 3000

# Start the application using Node.js natively
CMD ["node", "dist/main.js"]
