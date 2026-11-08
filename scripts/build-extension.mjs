import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { toFirefoxManifest } from './firefox-manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const outZip = resolve(distDir, 'moodl0-extension.zip');
const firefoxStage = resolve(distDir, 'firefox');
const outFirefoxZip = resolve(distDir, 'moodl0-extension-firefox.zip');

const include = [
  'manifest.json',
  '_locales',
  'css',
  'fonts',
  'html',
  'icons',
  'js',
  'scripts/update.sh',
  'scripts/update.ps1',
  'logo_main.png',
  '74d85fb11d53487d88e3.png',
  'LICENSE',
  'README.md'
];

function zip(cwd, out, entries, logName) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn('zip', ['-r', out, ...entries], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    proc.stdout.pipe(createWriteStream(resolve(distDir, logName)));
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(stderr || `zip exited with ${code}`));
    });
  });
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

// Chrome / Chromium build.
await zip(root, outZip, include, 'zip.log');
console.log(`Built ${outZip}`);

// Firefox build: same files, Gecko-flavoured manifest. The manifest must sit
// at the zip root, so stage a copy and zip from inside it.
await mkdir(firefoxStage, { recursive: true });
for (const entry of include) {
  if (entry === 'manifest.json') {
    continue;
  }
  await cp(resolve(root, entry), resolve(firefoxStage, entry), { recursive: true });
}
const chromeManifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
await writeFile(
  resolve(firefoxStage, 'manifest.json'),
  JSON.stringify(toFirefoxManifest(chromeManifest), null, 2) + '\n'
);
await zip(firefoxStage, outFirefoxZip, include, 'zip-firefox.log');
console.log(`Built ${outFirefoxZip}`);
