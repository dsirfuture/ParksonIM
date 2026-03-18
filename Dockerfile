FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

RUN npm run build \
  && mkdir -p .next/standalone/.next \
  && cp -R .next/static .next/standalone/.next/

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["npm", "run", "start:standalone"]
