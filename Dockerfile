FROM oven/bun:1.4.2
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --production
ENV NODE_ENV=production
CMD ["bun", "run", "start"]
