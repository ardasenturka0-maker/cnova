FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Europe/Istanbul
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates clamav && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY . .
RUN npx prisma generate && npm run build

FROM dependencies AS migrator
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM dependencies AS bootstrap
COPY prisma ./prisma
COPY tsconfig.json ./tsconfig.json
COPY scripts/bootstrap-clinic.ts ./scripts/bootstrap-clinic.ts
RUN npx prisma generate
CMD ["npm", "run", "clinic:bootstrap"]

FROM dependencies AS file-migrator
COPY prisma ./prisma
COPY tsconfig.json ./tsconfig.json
COPY scripts/migrate-patient-files-to-storage.ts ./scripts/migrate-patient-files-to-storage.ts
COPY src/lib/secure-file-storage.ts ./src/lib/secure-file-storage.ts
RUN npx prisma generate
CMD ["npm", "run", "files:migrate"]

FROM dependencies AS ops
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client rclone && rm -rf /var/lib/apt/lists/*
COPY prisma ./prisma
COPY tsconfig.json ./tsconfig.json
COPY scripts ./scripts
COPY ops ./ops
COPY src ./src
RUN npx prisma generate
CMD ["npm", "run", "ops:check"]

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs clinicnova && mkdir -p /var/lib/clinicnova/patient-files && chown -R clinicnova:nodejs /var/lib/clinicnova
COPY --from=builder --chown=clinicnova:nodejs /app/.next/standalone ./
COPY --from=builder --chown=clinicnova:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=clinicnova:nodejs /app/prisma ./prisma
USER clinicnova
VOLUME ["/var/lib/clinicnova/patient-files"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
