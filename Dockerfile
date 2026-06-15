FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ENV NODE_ENV=production

RUN npm run build

FROM node:22-alpine AS runner

RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/db ./db
COPY --from=builder /app/start.sh ./start.sh

RUN chmod +x start.sh

EXPOSE 4321

ENV HOST=0.0.0.0
ENV PORT=4321

CMD ["./start.sh"]
