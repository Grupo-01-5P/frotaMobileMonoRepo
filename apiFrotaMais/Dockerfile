# Use the official Node.js image as the base image
FROM node:22.16.0

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

RUN npx prisma generate


# Expose the port the app runs on
EXPOSE 4040

# Command to run the application
CMD ["node", "src/swagger.js"]