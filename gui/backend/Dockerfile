# Node.js LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Expose port (Railway sets PORT env variable)
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
