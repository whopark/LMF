# Node.js LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port (Back4app uses PORT env variable)
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
