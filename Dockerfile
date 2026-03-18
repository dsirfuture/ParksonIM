FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL

ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL=${NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL}

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

RUN npm run build \
  && mkdir -p .next/standalone/.next \
  && cp -R .next/static .next/standalone/.next/ \
  && cp -R public .next/standalone/

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["npm", "run", "start:standalone"]
