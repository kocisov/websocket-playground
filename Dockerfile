FROM node:16-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
USER node
CMD [ "pnpm", "start" ]
