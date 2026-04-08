#!/usr/bin/env npx tsx
/**
 * parallel-simulate.ts — fan out self-play simulation across all M5 cores.
 *
 * The single-process simulator at server/ai-simulate.ts hits ~25-50 games/sec
 * single-core (random policy) or much slower with the teacher AI. This
 * coordinator forks N children of that simulator, each writing to its own
 * shard JSONL file (`${output}.${pid}.jsonl`). When all children exit the
 * coordinator concatenates the shards into a single output file.
 *
 * Why fork (not worker_threads)
 * -----------------------------
 * - True OS process isolation — one crashing game doesn't take down the batch
 * - V8 isolates start fresh per worker (no shared state to bias the run)
 * - The M5's P-core/E-core scheduler handles 24 child Node procs cleanly
 * - We don't need shared memory because each game is independent
 *
 * Throughput target on the M5: 16 workers × ~30 teacher games/sec ≈ 480/s,
 * or 22 workers × ~25/s ≈ 550/s (P+E cores). Random policy roughly 4-8×
 * faster than teacher.
 *
 * Usage
 * -----
 *   npx tsx scripts/parallel-simulate.ts \\
 *     --workers 16 --games-per-worker 5000 --teacher \\
 *     --output data/sim-history.jsonl
 *
 *   npx tsx scripts/parallel-simulate.ts \\
 *     --workers 22 --games-per-worker 10000 \\
 *     --output data/sim-history-bootstrap.jsonl
 *
 *   # Resume: skip workers whose shard file already exists with content
 *   npx tsx scripts/parallel-simulate.ts ... --resume
 *
 *   # Keep individual shards instead of concatenating + deleting
 *   npx tsx scripts/parallel-simulate.ts ... --keep-shards
 */

import { spawn } from 'child_process';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SIM_ENTRY = join(REPO_ROOT, 'server', 'ai-simulate.ts');

// ── Args ──────────────────────────────────────────────────────────────

function getArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const cpuCount = os.cpus().length;
const workers = parseInt(getArg('workers', String(Math.max(1, cpuCount - 2)))!, 10);
const gamesPerWorker = parseInt(getArg('games-per-worker', '1000')!, 10);
const teacher = hasFlag('teacher');
const teacherVsTeacher = hasFlag('teacher-vs-teacher');
const recordMode = hasFlag('record');
const targeted = hasFlag('targeted');
const outputArg = getArg('output', 'data/sim-history.jsonl')!;
const outputPath = resolve(REPO_ROOT, outputArg);
const seedBase = parseInt(getArg('seed-base', String(Date.now() & 0xffffffff))!, 10);
const resume = hasFlag('resume');
const keepShards = hasFlag('keep-shards');
const verbose = hasFlag('verbose');

if (workers < 1 || gamesPerWorker < 1) {
  console.error('--workers and --games-per-worker must both be ≥ 1');
  process.exit(1);
}

mkdirSync(dirname(outputPath), { recursive: true });

console.log(`\n⚙️  parallel-simulate`);
console.log(`   workers:           ${workers}  (cpuCount=${cpuCount})`);
console.log(`   games per worker:  ${gamesPerWorker}`);
console.log(`   total games:       ${(workers * gamesPerWorker).toLocaleString()}`);
console.log(`   mode:              ${teacherVsTeacher ? 'teacher-vs-teacher' : teacher ? 'teacher' : 'random'}`);
console.log(`   output:            ${outputPath}`);
console.log(`   seed base:         ${seedBase}`);
console.log(`   resume:            ${resume}`);
console.log();

// ── Spawn children ────────────────────────────────────────────────────

interface WorkerHandle {
  id: number;
  shardId: string;
  pid: number; // npx pid, NOT the inner tsx pid — used only for logging
  shardPath: string;
  startedAt: number;
  endedAt?: number;
  exitCode?: number;
}

const handles: WorkerHandle[] = [];
let donePromiseResolve!: () => void;
const donePromise = new Promise<void>((r) => (donePromiseResolve = r));
let exitedCount = 0;

const startedAt = Date.now();

// Use a coordinator-issued shard ID per worker. We can't use the child
// process pid because `npx tsx` double-forks: the pid we see from spawn()
// is the npx wrapper, not the actual worker process. Passing
// SIM_SHARD_ID via env tells the worker exactly which file to write to.
const shardRunId = `${process.pid}-${Date.now().toString(36)}`;

for (let w = 0; w < workers; w++) {
  const shardId = `${shardRunId}-w${w}`;
  const shardPath = `${outputPath}.${shardId}.jsonl`;

  const childArgs = [
    SIM_ENTRY,
    '--games', String(gamesPerWorker),
  ];
  if (teacher) childArgs.push('--teacher');
  if (teacherVsTeacher) childArgs.push('--teacher-vs-teacher');
  if (recordMode) childArgs.push('--record');
  if (targeted) childArgs.push('--targeted');

  // Resume support: skip workers whose shard already exists with content
  if (resume && existsSync(shardPath) && statSync(shardPath).size > 0) {
    console.log(`  ⤿ worker ${w} resume: shard already exists (${basename(shardPath)})`);
    handles.push({
      id: w, shardId, pid: -1, shardPath,
      startedAt: Date.now(), endedAt: Date.now(), exitCode: 0,
    });
    exitedCount++;
    continue;
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SIM_HISTORY_FILE: outputPath,
    SIM_HISTORY_SHARD: '1',
    SIM_SHARD_ID: shardId,
    SIM_GAMES: String(gamesPerWorker),
    SIM_SEED: String(seedBase + w),
    // Single-thread BLAS / Node oversubscription guard
    OMP_NUM_THREADS: '1',
    VECLIB_MAXIMUM_THREADS: '1',
  };

  const child = spawn('npx', ['tsx', ...childArgs], {
    cwd: REPO_ROOT,
    env,
    stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });

  if (!child.pid) {
    console.error(`worker ${w}: failed to spawn`);
    continue;
  }

  const handle: WorkerHandle = {
    id: w,
    shardId,
    pid: child.pid,
    shardPath,
    startedAt: Date.now(),
  };
  handles.push(handle);
  console.log(`  → worker ${w} npx-pid=${child.pid} shard=${basename(handle.shardPath)}`);

  if (!verbose && child.stderr) {
    // Tee child stderr but suppress stdout to keep the coordinator output clean
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });
  }

  child.on('exit', (code) => {
    handle.endedAt = Date.now();
    handle.exitCode = code ?? 1;
    exitedCount++;
    const dur = ((handle.endedAt - handle.startedAt) / 1000).toFixed(1);
    const status = code === 0 ? '✓' : '✗';
    console.log(`  ${status} worker ${w} pid=${child.pid} exited ${code} (${dur}s)`);
    if (exitedCount === handles.length) donePromiseResolve();
  });
}

if (handles.length === 0) {
  console.error('no workers spawned, aborting');
  process.exit(1);
}

// Wrapped in async main() because tsx targets CJS for scripts in non-ESM
// packages and CJS doesn't support top-level await.
async function main(): Promise<number> {
  await donePromise;

  const wallSec = (Date.now() - startedAt) / 1000;
  const succeeded = handles.filter((h) => h.exitCode === 0).length;
  console.log(
    `\nworkers done: ${succeeded}/${handles.length} succeeded in ${wallSec.toFixed(1)}s`
  );

  // ── Concat shards into output ────────────────────────────────────────

  let totalLines = 0;
  let totalBytes = 0;

  if (existsSync(outputPath)) unlinkSync(outputPath);
  const out = createWriteStream(outputPath, { flags: 'a' });

  for (const h of handles) {
    if (!existsSync(h.shardPath)) {
      console.warn(`  shard missing for worker ${h.id}: ${h.shardPath}`);
      continue;
    }
    const sz = statSync(h.shardPath).size;
    if (sz === 0) {
      if (!keepShards) unlinkSync(h.shardPath);
      continue;
    }
    totalBytes += sz;

    await new Promise<void>((resolveCopy, reject) => {
      const inStream = createReadStream(h.shardPath);
      let buffer = '';
      inStream.on('data', (chunk: Buffer | string) => {
        buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        const lastNl = buffer.lastIndexOf('\n');
        if (lastNl >= 0) {
          const complete = buffer.slice(0, lastNl + 1);
          buffer = buffer.slice(lastNl + 1);
          for (let i = 0; i < complete.length; i++) {
            if (complete.charCodeAt(i) === 10) totalLines++;
          }
          out.write(complete);
        }
      });
      inStream.on('end', () => {
        if (buffer.length > 0) {
          // Trailing partial line — write it but don't count it (likely a
          // crash mid-write which the trainer will skip).
          out.write(buffer);
        }
        resolveCopy();
      });
      inStream.on('error', reject);
    });

    if (!keepShards) unlinkSync(h.shardPath);
  }

  await new Promise<void>((r) => out.end(r));

  const sizeMb = (totalBytes / 1024 / 1024).toFixed(1);
  console.log(
    `\nconcat: ${totalLines.toLocaleString()} games, ${sizeMb} MB → ${outputPath}`
  );
  console.log(
    `throughput: ${(totalLines / wallSec).toFixed(1)} games/sec across ${handles.length} workers\n`
  );

  const failed = handles.filter((h) => h.exitCode !== 0).length;
  return failed > 0 ? 1 : 0;
}

main().then((code) => process.exit(code), (err) => {
  console.error('parallel-simulate fatal error:', err);
  process.exit(2);
});
