# Start with a base image containing Node.js runtime
FROM node:lts-alpine as build-stage

ARG VITE_API_ENDPOINT
ENV VITE_API_ENDPOINT $VITE_API_ENDPOINT

# Set the working directory in the container to /app
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the current directory contents into the container at /app
COPY . .

# build app for production with minification
RUN npm run build

# production stage
FROM nginx:stable-alpine as production-stage

# Copy the build folder from the build stage to the nginx host folder
COPY --from=build-stage /app/dist/ /usr/share/nginx/html

# expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]