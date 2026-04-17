FROM node:20-bullseye

# python3-pip: mediasoup postinstall may build the worker if the prebuilt binary fails; build uses `pip` + `invoke`.
RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
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
