// Signs the Firefox build on addons.mozilla.org (unlisted channel) and
// writes dist/signed/<name>.xpi plus dist/signed/updates.json.
//
// Needs AMO API credentials in the environment:
//   AMO_JWT_ISSUER, AMO_JWT_SECRET  (addons.mozilla.org → Developer Hub → Manage API Keys)
//
// Usage:
//   npm run sign:firefox              stage dist/firefox from the sources, then sign
//   node scripts/sign-firefox.mjs --use-staged   sign an existing dist/firefox (CI)
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  FIREFOX_GECKO_ID,
  defaultUpdateUrl,
  repositoryUrlFromBuildConfig,
  stageFirefox
} from './firefox-manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stageDir = resolve(root, 'dist/firefox');
const signedDir = resolve(root, 'dist/signed');
const useStaged = process.argv.includes('--use-staged');

const issuer = process.env.AMO_JWT_ISSUER || '';
const secret = process.env.AMO_JWT_SECRET || '';
if (!issuer || !secret) {
  console.error('AMO_JWT_ISSUER and AMO_JWT_SECRET must be set (addons.mozilla.org → Developer Hub → Manage API Keys).');
  process.exit(2);
}

const repositoryUrl = (process.env.REPOSITORY_URL || await repositoryUrlFromBuildConfig(root)).replace(/\/+$/, '');
const updateUrl = process.env.FIREFOX_UPDATE_URL || defaultUpdateUrl(repositoryUrl);

let manifest;
if (useStaged) {
  if (!existsSync(resolve(stageDir, 'manifest.json'))) {
    console.error('dist/firefox/manifest.json not found; run without --use-staged.');
    process.exit(2);
  }
  manifest = JSON.parse(await readFile(resolve(stageDir, 'manifest.json'), 'utf8'));
} else {
  manifest = await stageFirefox(root, stageDir, { updateUrl });
}
const version = manifest.version;
console.log(`Signing ${FIREFOX_GECKO_ID} ${version} (unlisted)…`);

await rm(signedDir, { recursive: true, force: true });
await mkdir(signedDir, { recursive: true });

// Credentials go through WEB_EXT_* env vars, not the command line.
const args = [
  '--yes', 'web-ext@8', 'sign',
  '--source-dir', stageDir,
  '--artifacts-dir', signedDir,
  '--channel', 'unlisted',
  '--approval-timeout', '900000'
];
const env = { ...process.env, WEB_EXT_API_KEY: issuer, WEB_EXT_API_SECRET: secret };
const code = await new Promise((resolvePromise, reject) => {
  // npx is a .cmd shim on Windows and needs a shell; pass one quoted string.
  const proc = process.platform === 'win32'
    ? spawn(['npx', ...args].map((a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '""')}"` : a)).join(' '),
      { cwd: root, stdio: 'inherit', shell: true, env })
    : spawn('npx', args, { cwd: root, stdio: 'inherit', env });
  proc.on('error', reject);
  proc.on('close', resolvePromise);
});
if (code !== 0) {
  console.error(`\nSigning failed (web-ext exit code ${code}). Check the AMO keys and the message above.`);
  process.exit(1);
}

const xpi = (await readdir(signedDir)).find((name) => name.endsWith('.xpi'));
if (!xpi) {
  throw new Error('web-ext finished but no signed .xpi was downloaded.');
}
const xpiName = `moodl0-extension-firefox-${version}.xpi`;
await rename(resolve(signedDir, xpi), resolve(signedDir, xpiName));

// Firefox polls update_url (…/releases/latest/download/updates.json) and
// installs the XPI attached to the matching release.
if (repositoryUrl) {
  const updates = {
    addons: {
      [FIREFOX_GECKO_ID]: {
        updates: [{
          version,
          update_link: `${repositoryUrl}/releases/download/v${version}/${xpiName}`
        }]
      }
    }
  };
  await writeFile(resolve(signedDir, 'updates.json'), JSON.stringify(updates, null, 2) + '\n');
}

console.log(`Signed: dist/signed/${xpiName}`);
if (repositoryUrl) {
  console.log('Update manifest: dist/signed/updates.json');
}
