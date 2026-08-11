# Stage 1: Build the application
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the NestJS application
RUN npm run build

# Stage 2: Setup development environment
FROM public.ecr.aws/docker/library/node:20-alpine AS development

WORKDIR /usr/src/app

ENV NODE_ENV=development

# Copy all dependencies (including devDependencies like pino-pretty)
COPY package*.json ./
RUN npm ci

# Copy the built artifacts from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# The app listens on port 3000
EXPOSE 3000

# Start the application using Node.js natively
CMD ["node", "dist/main.js"]
