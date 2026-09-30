# Nginx sirve la tienda compilada y manda /api al backend, para que el
# navegador no tenga que salir de este dominio y no haga falta CORS.
FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:alpine

# El prefijo global de la API. src/lib/api.ts usa '/api/v1', y nginx lo
# reenvia al backend sin quitarle el prefijo.
ENV API_HOST=api
ENV API_PORT=3000

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
