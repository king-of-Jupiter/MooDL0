// Builds the Firefox (Gecko) variant of the extension from the Chrome one.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const FIREFOX_GECKO_ID = 'moodl0@moodl0.extension';
// data_collection_permissions is understood from Firefox 140 (ESR) on.
export const FIREFOX_MIN_VERSION = '140.0';

// Files shipped in both the Chrome and the Firefox package.
export const EXTENSION_FILES = [
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

// What the extension sends off the device (declared for AMO / Firefox consent):
// - websiteContent: question text and answers from the quiz page;
// - websiteActivity: which Moodle site / course / quiz is being taken;
// - personallyIdentifyingInfo: the Moodle user id sent with quiz metadata;
// - technicalAndInteraction (optional): error logs and usage counters.
export const DATA_COLLECTION = {
  required: ['websiteContent', 'websiteActivity', 'personallyIdentifyingInfo'],
  optional: ['technicalAndInteraction']
};

export function defaultUpdateUrl(repositoryUrl) {
  const repo = String(repositoryUrl || '').trim().replace(/\/+$/, '');
  return /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(repo)
    ? repo + '/releases/latest/download/updates.json'
    : '';
}

export function toFirefoxManifest(chromeManifest, options = {}) {
  const m = structuredClone(chromeManifest);

  // Chrome-only keys.
  delete m.key;
  delete m.update_url;

  // Firefox MV3 has no service workers for extensions: use an event page.
  m.background = {
    scripts: [
      'js/firefox_background_shim.js',
      'js/background_worker.js',
      'js/background.js',
      'js/build_config.js',
      'js/platform_settings.js',
      'js/i18n.js',
      'js/moodle_queue.js'
    ]
  };

  // browser_style is not supported in Firefox MV3.
  if (m.action) {
    delete m.action.browser_style;
  }

  if (Array.isArray(m.web_accessible_resources)) {
    m.web_accessible_resources = m.web_accessible_resources.map((entry) => {
      const copy = { ...entry };
      delete copy.use_dynamic_url;
      return copy;
    });
  }

  const gecko = {
    id: FIREFOX_GECKO_ID,
    strict_min_version: FIREFOX_MIN_VERSION,
    data_collection_permissions: structuredClone(DATA_COLLECTION)
  };
  // Self-distributed (unlisted) builds update from updates.json in the
  // latest GitHub release.
  if (options.updateUrl) {
    gecko.update_url = options.updateUrl;
  }
  m.browser_specific_settings = { gecko };

  return m;
}

// Not shipped to Firefox: the git-based updater scripts only make sense for
// an unpacked Chrome install, and AMO flags shell scripts in packages.
export const FIREFOX_EXCLUDED = ['scripts/update.sh', 'scripts/update.ps1'];
export const FIREFOX_FILES = EXTENSION_FILES.filter((entry) => !FIREFOX_EXCLUDED.includes(entry));

// Copies the extension into outDir with the Firefox manifest in place.
export async function stageFirefox(root, outDir, options = {}) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  for (const entry of FIREFOX_FILES) {
    if (entry === 'manifest.json') {
      continue;
    }
    await cp(resolve(root, entry), resolve(outDir, entry), { recursive: true });
  }
  const chromeManifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  const manifest = toFirefoxManifest(chromeManifest, options);
  await writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

// Reads repositoryUrl from the generated js/build_config.js (local builds).
export async function repositoryUrlFromBuildConfig(root) {
  try {
    const text = await readFile(resolve(root, 'js/build_config.js'), 'utf8');
    const match = text.match(/"repositoryUrl"\s*:\s*"([^"]*)"/);
    return match ? match[1] : '';
  } catch (_) {
    return '';
  }
}
