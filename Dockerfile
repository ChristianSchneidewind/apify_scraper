FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./

# The CLI drives an external Chrome over CDP (--cdp-url); no browser is
# bundled or downloaded into this image.

CMD ["node", "--import", "tsx", "cli/src/bin/instagram.ts", "--help"]
