# Runs the Plastic Front game server anywhere that runs containers (Fly.io, Railway, a VPS).
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN node build.js
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/server.js"]
