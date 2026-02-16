FROM node:18-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY public ./public
COPY src ./src

# Build the React app
ARG REACT_APP_API_BASE_URL=http://localhost:6001/api
ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /usr/src/app/build /usr/share/nginx/html

# Simple default nginx config suitable for SPA
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


