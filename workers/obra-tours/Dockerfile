# Worker Tours 3D — imagen CPU (pipeline frames_glb).
# Para COLMAP/GPU: usar imagen CUDA y OBRA_TOURS_PIPELINE=colmap.
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src

ENV PORT=8787
ENV OBRA_TOURS_PIPELINE=frames_glb
EXPOSE 8787

CMD ["npx", "tsx", "src/index.ts"]
