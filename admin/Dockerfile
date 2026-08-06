# Debian-based rather than Alpine: better-sqlite3 (and sharp, later) publish
# prebuilt glibc binaries, so no compiler toolchain is needed in the image.
FROM node:22-bookworm-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application files
COPY server.js db.js images.js ./
COPY public ./public

# Persistent state: SQLite database, image originals, derivative cache.
# Mount a Coolify volume here — anything written outside it is lost on redeploy.
ENV DATA_DIR=/data
VOLUME ["/data"]

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
