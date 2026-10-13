FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server ./server
COPY web ./web
COPY js/utils ./js/utils
COPY css ./css
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
