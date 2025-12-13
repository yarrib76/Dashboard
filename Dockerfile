FROM node:20-bookworm-slim

# Dependencias necesarias para mysql2 / node-gyp
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Directorio interno estándar del contenedor
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3030

# Instalar dependencias primero (mejor cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar el resto de la aplicación
COPY . .

EXPOSE 3030

CMD ["npm", "start"]
