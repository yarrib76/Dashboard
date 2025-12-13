FROM node:20-bullseye-slim

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3030

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3030
CMD ["npm", "start"]