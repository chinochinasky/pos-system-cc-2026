FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# En producción Next.js necesita compilar el proyecto
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
