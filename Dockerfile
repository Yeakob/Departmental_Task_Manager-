# --- build the client ---
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- runtime: API serves the built client on one origin ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
