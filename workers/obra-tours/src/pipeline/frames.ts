import { mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

async function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      resolve({ code: 127, stderr: err.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stderr });
    });
  });
}

export async function downloadVideo(videoUrl: string, destPath: string): Promise<number> {
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`No se pudo descargar video (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const maxMb = Number(process.env.OBRA_TOURS_MAX_VIDEO_MB ?? '512');
  if (buf.length > maxMb * 1024 * 1024) {
    throw new Error(`Video supera límite de ${maxMb} MB`);
  }
  await writeFile(destPath, buf);
  return buf.length;
}

export type FrameExtractResult = {
  workDir: string;
  frameCount: number;
  ffmpegUsed: boolean;
  note: string;
};

/** Extrae keyframes con ffmpeg si está disponible. */
export async function extractFrames(opts: {
  videoPath: string;
  calidad: 'rapida' | 'detallada';
}): Promise<FrameExtractResult> {
  const workDir = join(tmpdir(), `obra-tours-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });
  const pattern = join(workDir, 'frame-%04d.jpg');
  const fps = opts.calidad === 'detallada' ? '2' : '1';

  const probe = await run('ffmpeg', ['-version']);
  if (probe.code !== 0) {
    return {
      workDir,
      frameCount: 0,
      ffmpegUsed: false,
      note: 'ffmpeg no disponible; se genera malla procedural sin frames',
    };
  }

  const extracted = await run('ffmpeg', [
    '-y',
    '-i',
    opts.videoPath,
    '-vf',
    `fps=${fps}`,
    '-q:v',
    '5',
    pattern,
  ]);

  if (extracted.code !== 0) {
    return {
      workDir,
      frameCount: 0,
      ffmpegUsed: true,
      note: `ffmpeg falló: ${extracted.stderr.slice(0, 200)}`,
    };
  }

  const files = (await readdir(workDir)).filter((f) => f.endsWith('.jpg'));
  return {
    workDir,
    frameCount: files.length,
    ffmpegUsed: true,
    note: `Extraídos ${files.length} frames @ ${fps} fps`,
  };
}

export async function cleanupDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
