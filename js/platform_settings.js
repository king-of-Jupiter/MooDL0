(function (global) {
    const STORAGE_KEY = 'paramExtPlatformSettingsV2';
    const LEGACY_KEY = 'paramExtSettings';

    const DEFAULT_BACKEND_CONFIG = {
        apiBaseUrl: 'https://syncshare.naloaty.me/api',
        apiToken: '',
        requestTimeoutMs: 4000
    };

    const buildConfig = global.ParamExtBuildConfig || {};

    const DEFAULT_SETTINGS = {
        activePlatform: 'moodle',
        backend: {
            moodle: Object.assign(deepClone(DEFAULT_BACKEND_CONFIG), {
                apiBaseUrl: buildConfig.moodleApiBaseUrl || DEFAULT_BACKEND_CONFIG.apiBaseUrl
            })
        },
        onboarding: {
            privacyAccepted: false,
            allowTechnicalDataCollection: true,
            completed: false,
            moodleOnly: true
        },
        ui: {
            lastTab: 'moodle'
        },
        moodle: {
            mode: 'wand',
            wandHotkey: 'Escape',
            insertHotkey: 'Alt+KeyA',
            autoInsertOnLoad: true,
            nextButtonText: 'Следующая страница',
            autoSolving: false,
            autoFinishAttempt: false,
            autoSubmitAttempt: false,
            hideWidgetByDefault: false
        },
        diagnostics: {}
    };

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function toNumberOrFallback(value, fallback) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function normalizeHotkey(value, fallback) {
        if (typeof value !== 'string') {
            return fallback;
        }
        const normalized = value.trim();
        return normalized.length > 0 ? normalized : fallback;
    }

    function normalizeSettings(raw) {
        const next = deepClone(DEFAULT_SETTINGS);
        const source = raw && typeof raw === 'object' ? raw : {};

        next.activePlatform = 'moodle';

        if (source.backend && typeof source.backend === 'object') {
            const backend = source.backend;
            const current = backend.moodle && typeof backend.moodle === 'object' ? backend.moodle : null;
            const legacy = (!current && typeof backend.apiBaseUrl === 'string') ? backend : null;
            const effective = current || legacy;
            if (effective) {
                if (typeof effective.apiBaseUrl === 'string' && effective.apiBaseUrl.trim().length > 0) {
                    next.backend.moodle.apiBaseUrl = effective.apiBaseUrl.trim().replace(/\/$/, '');
                }
                if (typeof effective.apiToken === 'string') {
                    next.backend.moodle.apiToken = effective.apiToken.trim();
                }
                next.backend.moodle.requestTimeoutMs = Math.max(1000, toNumberOrFallback(effective.requestTimeoutMs, next.backend.moodle.requestTimeoutMs));
            }
        }

        if (source.moodle && typeof source.moodle === 'object') {
            const moodle = source.moodle;
            if (moodle.mode === 'wand' || moodle.mode === 'autoInsert' || moodle.mode === 'autoSolve') {
                next.moodle.mode = moodle.mode;
            }
            next.moodle.wandHotkey = normalizeHotkey(moodle.wandHotkey, next.moodle.wandHotkey);
            next.moodle.insertHotkey = normalizeHotkey(moodle.insertHotkey, next.moodle.insertHotkey);
            next.moodle.autoInsertOnLoad = moodle.autoInsertOnLoad !== false;
            if (typeof moodle.nextButtonText === 'string' && moodle.nextButtonText.trim().length > 0) {
                next.moodle.nextButtonText = moodle.nextButtonText.trim();
            }
            next.moodle.autoSolving = Boolean(moodle.autoSolving);
            next.moodle.autoFinishAttempt = Boolean(moodle.autoFinishAttempt);
            next.moodle.autoSubmitAttempt = Boolean(moodle.autoSubmitAttempt);
            next.moodle.hideWidgetByDefault = Boolean(moodle.hideWidgetByDefault);
        }

        if (source.onboarding && typeof source.onboarding === 'object') {
            next.onboarding.privacyAccepted = Boolean(source.onboarding.privacyAccepted);
            next.onboarding.allowTechnicalDataCollection = source.onboarding.allowTechnicalDataCollection !== false;
            next.onboarding.completed = Boolean(source.onboarding.completed);
            next.onboarding.moodleOnly = true;
        }

        if (source.ui && typeof source.ui === 'object') {
            if (['moodle', 'stats', 'diagnostics'].includes(source.ui.lastTab)) {
                next.ui.lastTab = source.ui.lastTab;
            }
        }

        return next;
    }

    function toLegacySettings(raw) {
        const normalized = normalizeSettings(raw);
        return {
            mode: normalized.moodle.mode,
            wandKey: normalized.moodle.wandHotkey,
            insertKey: normalized.moodle.insertHotkey,
            autoInsertOnLoad: normalized.moodle.autoInsertOnLoad,
            autoFinishAttempt: normalized.moodle.autoFinishAttempt,
            autoSubmitAttempt: normalized.moodle.autoSubmitAttempt,
            nextBtnText: normalized.moodle.nextButtonText,
            autoSolving: normalized.moodle.autoSolving,
            hideWidgetByDefault: normalized.moodle.hideWidgetByDefault,
            privacyPolicyAcceptedByUser: normalized.onboarding.privacyAccepted,
            allowTechnicalDataCollection: normalized.onboarding.allowTechnicalDataCollection,
            backend: {
                apiBaseUrl: normalized.backend.moodle.apiBaseUrl,
                apiToken: normalized.backend.moodle.apiToken,
                requestTimeoutMs: normalized.backend.moodle.requestTimeoutMs
            }
        };
    }

    function storageGet(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(key, (result) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    reject(lastError);
                    return;
                }
                resolve(result);
            });
        });
    }

    function storageSet(value) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(value, () => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    reject(lastError);
                    return;
                }
                resolve();
            });
        });
    }

    async function migrateFromLegacy() {
        try {
            const payload = await storageGet(LEGACY_KEY);
            const legacy = payload[LEGACY_KEY];
            if (!legacy || typeof legacy !== 'object') {
                return null;
            }

            const migrated = deepClone(DEFAULT_SETTINGS);
            if (legacy.mode === 'wand' || legacy.mode === 'autoInsert' || legacy.mode === 'autoSolve') {
                migrated.moodle.mode = legacy.mode;
            }
            if (typeof legacy.wandKey === 'string' && legacy.wandKey.trim().length > 0) {
                migrated.moodle.wandHotkey = legacy.wandKey.trim();
            }
            if (typeof legacy.insertKey === 'string' && legacy.insertKey.trim().length > 0) {
                migrated.moodle.insertHotkey = legacy.insertKey.trim();
            }
            if (Object.prototype.hasOwnProperty.call(legacy, 'autoInsertOnLoad')) {
                migrated.moodle.autoInsertOnLoad = legacy.autoInsertOnLoad !== false;
            }
            if (typeof legacy.nextBtnText === 'string' && legacy.nextBtnText.trim().length > 0) {
                migrated.moodle.nextButtonText = legacy.nextBtnText.trim();
            }
            migrated.onboarding.privacyAccepted = Boolean(legacy.privacyPolicyAcceptedByUser);
            migrated.onboarding.allowTechnicalDataCollection = legacy.allowTechnicalDataCollection !== false;
            migrated.onboarding.completed = Boolean(legacy.privacyPolicyAcceptedByUser);
            migrated.onboarding.moodleOnly = true;
            if (legacy.backend && typeof legacy.backend === 'object') {
                if (typeof legacy.backend.apiBaseUrl === 'string' && legacy.backend.apiBaseUrl.trim().length > 0) {
                    migrated.backend.moodle.apiBaseUrl = legacy.backend.apiBaseUrl.trim().replace(/\/$/, '');
                }
                if (typeof legacy.backend.apiToken === 'string') {
                    migrated.backend.moodle.apiToken = legacy.backend.apiToken.trim();
                }
                const timeoutMs = Math.max(1000, toNumberOrFallback(legacy.backend.requestTimeoutMs, migrated.backend.moodle.requestTimeoutMs));
                migrated.backend.moodle.requestTimeoutMs = timeoutMs;
            }
            migrated.moodle.autoSolving = Boolean(legacy.autoSolving);

            await storageSet({
                [STORAGE_KEY]: migrated,
                [LEGACY_KEY]: toLegacySettings(migrated)
            });
            return migrated;
        } catch (_) {
            return null;
        }
    }

    async function getSettings() {
        try {
            const payload = await storageGet(STORAGE_KEY);
            if (payload[STORAGE_KEY]) {
                const normalized = normalizeSettings(payload[STORAGE_KEY]);
                await storageSet({ [LEGACY_KEY]: toLegacySettings(normalized) });
                return normalized;
            }

            const migrated = await migrateFromLegacy();
            if (migrated) {
                return normalizeSettings(migrated);
            }

            await storageSet({
                [STORAGE_KEY]: DEFAULT_SETTINGS,
                [LEGACY_KEY]: toLegacySettings(DEFAULT_SETTINGS)
            });
            return deepClone(DEFAULT_SETTINGS);
        } catch (_) {
            return deepClone(DEFAULT_SETTINGS);
        }
    }

    async function saveSettings(settings) {
        const normalized = normalizeSettings(settings);
        await storageSet({
            [STORAGE_KEY]: normalized,
            [LEGACY_KEY]: toLegacySettings(normalized)
        });
        return normalized;
    }

    async function clearBackendApiBaseUrl(platform) {
        const payload = await storageGet(STORAGE_KEY);
        const raw = payload[STORAGE_KEY] && typeof payload[STORAGE_KEY] === 'object'
            ? deepClone(payload[STORAGE_KEY])
            : {};

        if (raw.backend && typeof raw.backend === 'object') {
            if (raw.backend.moodle && typeof raw.backend.moodle === 'object') {
                delete raw.backend.moodle.apiBaseUrl;
            }

            // Legacy shape fallback where backend settings were shared.
            if (Object.prototype.hasOwnProperty.call(raw.backend, 'apiBaseUrl')) {
                delete raw.backend.apiBaseUrl;
            }
        }

        const normalized = normalizeSettings(raw);
        await storageSet({
            [STORAGE_KEY]: raw,
            [LEGACY_KEY]: toLegacySettings(normalized)
        });
        return normalized;
    }

    function serializeHotkey(event) {
        const parts = [];
        if (event.ctrlKey) {
            parts.push('Ctrl');
        }
        if (event.altKey) {
            parts.push('Alt');
        }
        if (event.shiftKey) {
            parts.push('Shift');
        }
        if (event.metaKey) {
            parts.push('Meta');
        }

        const keyCode = event.code || event.key;
        if (!keyCode) {
            return parts.join('+');
        }

        const blockedModifierOnly = ['ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'];
        if (blockedModifierOnly.includes(keyCode)) {
            return parts.join('+');
        }

        parts.push(keyCode);
        return parts.join('+');
    }

    function parseHotkey(raw) {
        const normalized = normalizeHotkey(raw, '');
        if (!normalized) {
            return { ctrl: false, alt: false, shift: false, meta: false, key: '' };
        }

        const chunks = normalized.split('+').map((chunk) => chunk.trim()).filter(Boolean);
        const parsed = { ctrl: false, alt: false, shift: false, meta: false, key: '' };

        for (const chunk of chunks) {
            if (chunk === 'Ctrl') {
                parsed.ctrl = true;
            } else if (chunk === 'Alt') {
                parsed.alt = true;
            } else if (chunk === 'Shift') {
                parsed.shift = true;
            } else if (chunk === 'Meta') {
                parsed.meta = true;
            } else {
                parsed.key = chunk;
            }
        }

        return parsed;
    }

    function hotkeyMatches(event, hotkeyRaw) {
        const hotkey = parseHotkey(hotkeyRaw);
        if (!hotkey.key) {
            return false;
        }

        return (
            event.ctrlKey === hotkey.ctrl &&
            event.altKey === hotkey.alt &&
            event.shiftKey === hotkey.shift &&
            event.metaKey === hotkey.meta &&
            (event.code === hotkey.key || event.key === hotkey.key)
        );
    }

    function getBackendByPlatform(settings, platform) {
        const normalized = normalizeSettings(settings);
        return deepClone(normalized.backend.moodle);
    }

    global.ParamExtMoodleQueue = {
        request(message) {
            return new Promise((resolve, reject) => {
                const port = chrome.runtime.connect({ name: 'moodle-queue' });
                port.onMessage.addListener((response) => {
                    resolve(response);
                    port.disconnect();
                });
                port.onDisconnect.addListener(() => {
                    reject(new Error(chrome.runtime.lastError?.message || 'Соединение с очередью Moodle закрыто.'));
                });
                port.postMessage(message);
            });
        }
    };

    global.ParamExtSettings = {
        STORAGE_KEY,
        DEFAULT_SETTINGS,
        normalizeSettings,
        getSettings,
        saveSettings,
        clearBackendApiBaseUrl,
        serializeHotkey,
        parseHotkey,
        hotkeyMatches,
        getBackendByPlatform
    };
})(globalThis);
