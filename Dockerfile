# Company dashboard - static Angular build (no SSR) served by nginx.
# The server addresses come from docker-compose at runtime (docker-entrypoint.sh -> env.js).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production \
    && cd dist/*/browser \
    && { [ -f index.html ] || cp index.csr.html index.html; }

FROM nginx:alpine AS final
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/dashboard-app/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
