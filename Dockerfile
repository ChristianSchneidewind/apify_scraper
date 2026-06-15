FROM mcr.microsoft.com/playwright:v1.53.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./

RUN npx playwright install chromium

CMD ["node", "--import", "tsx", "cli/src/bin/instagram.ts", "--help"]
