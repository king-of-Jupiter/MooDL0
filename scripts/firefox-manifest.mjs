// Builds the Firefox (Gecko) variant of manifest.json from the Chrome one.
export const FIREFOX_GECKO_ID = 'moodl0@moodl0.extension';
export const FIREFOX_MIN_VERSION = '128.0';

export function toFirefoxManifest(chromeManifest) {
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

  m.browser_specific_settings = {
    gecko: {
      id: FIREFOX_GECKO_ID,
      strict_min_version: FIREFOX_MIN_VERSION
    }
  };

  return m;
}
