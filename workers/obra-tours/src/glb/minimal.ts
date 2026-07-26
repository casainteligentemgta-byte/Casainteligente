/**
 * Genera un GLB binario mínimo (glTF 2.0) con malla de obra procedural.
 * Sirve como salida del pipeline frames_glb hasta cablear COLMAP/splat.
 */

function align4(n: number): number {
  return (n + 3) & ~3;
}

function encodeText(json: string): Uint8Array {
  return new TextEncoder().encode(json);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export type ObraMeshParams = {
  /** Número de “bloques” / estructuras (influido por frames / calidad). */
  bloques: number;
  /** Escala horizontal aprox. en metros. */
  span: number;
  fuente: 'celular' | 'dron';
};

/** Construye posiciones/índices de una escena simple de obra. */
export function buildObraMesh(params: ObraMeshParams): {
  positions: Float32Array;
  indices: Uint16Array;
  colors: Float32Array;
} {
  const bloques = Math.max(2, Math.min(24, Math.floor(params.bloques)));
  const span = Math.max(4, params.span);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Suelo
  const y0 = 0;
  const half = span / 2;
  const base = 0;
  positions.push(
    -half, y0, -half,
    half, y0, -half,
    half, y0, half,
    -half, y0, half,
  );
  for (let i = 0; i < 4; i++) colors.push(0.35, 0.38, 0.42);
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);

  const altitudeBias = params.fuente === 'dron' ? 1.4 : 1;
  for (let i = 0; i < bloques; i++) {
    const t = i / Math.max(1, bloques - 1);
    const cx = -half * 0.7 + t * span * 0.7 + Math.sin(i * 1.7) * 0.8;
    const cz = -half * 0.5 + ((i * 37) % 100) / 100 * span * 0.9;
    const w = 0.8 + (i % 3) * 0.35;
    const d = 0.7 + (i % 2) * 0.4;
    const h = (1.2 + (i % 5) * 0.55) * altitudeBias;
    const v0 = positions.length / 3;
    const verts = [
      [cx - w / 2, 0, cz - d / 2],
      [cx + w / 2, 0, cz - d / 2],
      [cx + w / 2, 0, cz + d / 2],
      [cx - w / 2, 0, cz + d / 2],
      [cx - w / 2, h, cz - d / 2],
      [cx + w / 2, h, cz - d / 2],
      [cx + w / 2, h, cz + d / 2],
      [cx - w / 2, h, cz + d / 2],
    ];
    const r = 0.55 + (i % 4) * 0.08;
    const g = 0.62 + (i % 3) * 0.06;
    const b = 0.7;
    for (const [x, y, z] of verts) {
      positions.push(x, y, z);
      colors.push(r, g, b);
    }
    const faces = [
      [0, 1, 2, 0, 2, 3],
      [4, 6, 5, 4, 7, 6],
      [0, 4, 5, 0, 5, 1],
      [1, 5, 6, 1, 6, 2],
      [2, 6, 7, 2, 7, 3],
      [3, 7, 4, 3, 4, 0],
    ];
    for (const f of faces) {
      for (const idx of f) indices.push(v0 + idx);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint16Array(indices),
    colors: new Float32Array(colors),
  };
}

/** Empaqueta malla en archivo .glb. */
export function encodeGlb(mesh: {
  positions: Float32Array;
  indices: Uint16Array;
  colors: Float32Array;
}): Buffer {
  const posBytes = new Uint8Array(mesh.positions.buffer, mesh.positions.byteOffset, mesh.positions.byteLength);
  const colBytes = new Uint8Array(mesh.colors.buffer, mesh.colors.byteOffset, mesh.colors.byteLength);
  const idxBytes = new Uint8Array(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength);

  const posPad = align4(posBytes.length) - posBytes.length;
  const colPad = align4(colBytes.length) - colBytes.length;
  const idxPad = align4(idxBytes.length) - idxBytes.length;

  const posOffset = 0;
  const colOffset = posBytes.length + posPad;
  const idxOffset = colOffset + colBytes.length + colPad;
  const binLength = idxOffset + idxBytes.length + idxPad;

  const bin = new Uint8Array(binLength);
  bin.set(posBytes, posOffset);
  bin.set(colBytes, colOffset);
  bin.set(idxBytes, idxOffset);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i]!;
    const y = mesh.positions[i + 1]!;
    const z = mesh.positions[i + 2]!;
    minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
  }

  const gltf = {
    asset: { version: '2.0', generator: 'obra-tours-worker' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'obra' }],
    meshes: [
      {
        name: 'obra_mesh',
        primitives: [
          {
            attributes: { POSITION: 0, COLOR_0: 1 },
            indices: 2,
            mode: 4,
          },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: mesh.positions.length / 3,
        type: 'VEC3',
        max: [maxX, maxY, maxZ],
        min: [minX, minY, minZ],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: mesh.colors.length / 3,
        type: 'VEC3',
      },
      {
        bufferView: 2,
        componentType: 5123,
        count: mesh.indices.length,
        type: 'SCALAR',
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOffset, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: colOffset, byteLength: colBytes.length, target: 34962 },
      { buffer: 0, byteOffset: idxOffset, byteLength: idxBytes.length, target: 34963 },
    ],
    buffers: [{ byteLength: binLength }],
  };

  let json = JSON.stringify(gltf);
  const jsonPad = (4 - (json.length % 4)) % 4;
  json += ' '.repeat(jsonPad);
  const jsonBytes = encodeText(json);

  const totalLength = 12 + 8 + jsonBytes.length + 8 + binLength;
  const out = Buffer.alloc(totalLength);
  let o = 0;
  out.writeUInt32LE(0x46546c67, o); o += 4; // glTF
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(totalLength, o); o += 4;

  out.writeUInt32LE(jsonBytes.length, o); o += 4;
  out.writeUInt32LE(0x4e4f534a, o); o += 4; // JSON
  Buffer.from(jsonBytes).copy(out, o); o += jsonBytes.length;

  out.writeUInt32LE(binLength, o); o += 4;
  out.writeUInt32LE(0x004e4942, o); o += 4; // BIN\0
  Buffer.from(bin).copy(out, o);

  return out;
}

export function buildObraGlb(params: ObraMeshParams): Buffer {
  return encodeGlb(buildObraMesh(params));
}
