FROM node:20-bullseye

RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# `postinstall` runs `scripts/prisma-generate-retry.cjs` — copy it + schema before `npm install`.
COPY prisma ./prisma/
COPY scripts/prisma-generate-retry.cjs ./scripts/prisma-generate-retry.cjs
RUN npm install

COPY . .

EXPOSE 3000
EXPOSE 40000-49999/udp

CMD ["npm", "run", "dev"]
