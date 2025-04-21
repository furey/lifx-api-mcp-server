FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --production --no-fund --no-audit

COPY . .

ENTRYPOINT ["node", "lifx-api-mcp-server.js"]
