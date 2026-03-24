FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

RUN addgroup -g 1001 -S forwarder && adduser -S forwarder -u 1001 -G forwarder \
  && chown -R forwarder:forwarder /app

USER forwarder

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HEARTBEAT_PATH=/health

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3000/health" || exit 1

CMD ["node", "./node_modules/tsx/dist/cli.mjs", "src/server.ts"]
