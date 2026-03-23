FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app \
  && chown -R app:app /app

USER app

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HEARTBEAT_PATH=/health

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3000/health" || exit 1

CMD ["node", "src/server.js"]
