import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EXTENSION_FILES, FIREFOX_FILES, defaultUpdateUrl, repositoryUrlFromBuildConfig, stageFirefox } from './firefox-manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const outZip = resolve(distDir, 'moodl0-extension.zip');
const firefoxStage = resolve(distDir, 'firefox');
const outFirefoxZip = resolve(distDir, 'moodl0-extension-firefox.zip');

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
await zip(root, outZip, EXTENSION_FILES, 'zip.log');
console.log(`Built ${outZip}`);

// Firefox build: same files, Gecko-flavoured manifest. The manifest must sit
// at the zip root, so stage a copy and zip from inside it.
const repositoryUrl = process.env.REPOSITORY_URL || await repositoryUrlFromBuildConfig(root);
const updateUrl = process.env.FIREFOX_UPDATE_URL || defaultUpdateUrl(repositoryUrl);
await stageFirefox(root, firefoxStage, { updateUrl });
await zip(firefoxStage, outFirefoxZip, FIREFOX_FILES, 'zip-firefox.log');
console.log(`Built ${outFirefoxZip}`);
