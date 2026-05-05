# LMF Backend Dockerfile
# Build from repository root, targeting gui/backend

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy backend package files
COPY gui/backend/package*.json ./

# Install dependencies (production only)
RUN npm ci --omit=dev

# Copy backend source code
COPY gui/backend/ ./

# Expose port (Back4app uses PORT env variable)
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
