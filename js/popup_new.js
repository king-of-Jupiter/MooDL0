document.addEventListener('DOMContentLoaded', async () => {
    if (!window.ParamExtSettings) {
        return;
    }

    const buildConfig = window.ParamExtBuildConfig || {};
    const manifest = chrome.runtime.getManifest();
    const settingsApi = window.ParamExtSettings;
    const $ = (id) => document.getElementById(id);

    if (window.ParamExtTelemetry) {
        window.ParamExtTelemetry.installGlobalHandlers('popup');
    }

    const refs = {
        mainLogo: $('mainLogo'),
        headerStatus: $('headerStatusText'),
        headerDot: $('headerDot'),
        modeHint: $('modeHint'),
        autoSolveDot: $('autoSolveDot'),
        autoSolveState: $('autoSolveState'),
        moodleAutoInsertRow: $('moodleAutoInsertRow'),
        wandKeyHint: $('wandKeyHint'),
        insertKeyHint: $('insertKeyHint'),
        queueCountBadge: $('queueCountBadge'),
        queueCountLabel: $('queueCountLabel'),
        queueStatusBox: $('queueStatusBox'),
        queueProgress: $('queueProgress'),
        queueProgressBar: $('queueProgressBar'),
        versionPill: $('versionPill'),
        telegramChannelLink: $('telegramChannelLink'),
        privacyScreen: $('privacyScreen'),
        openPrivacyBtn: $('openPrivacyBtn'),
        refreshPrivacyBtn: $('refreshPrivacyBtn'),
        appScreen: $('appScreen'),
        customBackendToggle: $('customBackendToggle'),
        customBackendFields: $('customBackendFields'),
        backendApiBaseUrl: $('backendApiBaseUrl'),
        backendRequestTimeoutMs: $('backendRequestTimeoutMs'),
        backendResetUrlBtn: $('backendResetUrlBtn'),
        backendPingStatus: $('backendPingStatus'),
        backendCompactStatus: $('backendCompactStatus'),
        moodleSettings: $('moodleSettings'),
        diagnosticsPanel: $('diagnosticsPanel'),
        autoSolveControls: $('autoSolveControls'),
        btnStart: $('btnStart'),
        btnStop: $('btnStop'),
        wandKey: $('wandKey'),
        moodleAutoInsertOnLoad: $('moodleAutoInsertOnLoad'),
        moodleInsertKey: $('moodleInsertKey'),
        nextBtnSelector: $('nextBtnSelector'),
        moodleAutoFinishAttempt: $('moodleAutoFinishAttempt'),
        moodleAutoFinishRow: $('moodleAutoFinishRow'),
        moodleAutoSubmitAttempt: $('moodleAutoSubmitAttempt'),
        moodleAutoSubmitRow: $('moodleAutoSubmitRow'),
        moodleQueueFile: $('moodleQueueFile'),
        moodleQueueImportBtn: $('moodleQueueImportBtn'),
        moodleQueueTextarea: $('moodleQueueTextarea'),
        moodleQueueAddText: $('moodleQueueAddText'),
        moodleQueueAddCurrent: $('moodleQueueAddCurrent'),
        moodleQueueClear: $('moodleQueueClear'),
        moodleQueueList: $('moodleQueueList'),
        moodleQueueStart: $('moodleQueueStart'),
        moodleQueueStop: $('moodleQueueStop'),
        moodleQueueStatus: $('moodleQueueStatus'),
        updateCheckBtn: $('updateCheckBtn'),
        updateStatus: $('updateStatus'),
        buildStatus: $('buildStatus'),
        btnSave: $('btnSave'),
        confirmBeforeSubmit: $('confirmBeforeSubmit'),
        confirmBeforeSubmitRow: $('confirmBeforeSubmitRow'),
        minConfidence: $('minConfidence'),
        minVotes: $('minVotes'),
        pageDelayMin: $('pageDelayMin'),
        pageDelayMax: $('pageDelayMax'),
        thresholdBlock: $('thresholdBlock'),
        delayBlock: $('delayBlock'),
        moodleQueueResume: $('moodleQueueResume'),
        moodleQueueAddPage: $('moodleQueueAddPage'),
        historyBox: $('historyBox'),
        historyList: $('historyList'),
        historyCount: $('historyCount'),
        historyClear: $('historyClear'),
        uiLanguage: $('uiLanguage'),
        notifyQueue: $('notifyQueue'),
        exportBtn: $('exportBtn'),
        importBtn: $('importBtn'),
        importFile: $('importFile'),
        transferStatus: $('transferStatus')
    };

    const i18n = window.ParamExtI18n;
    const t = (text, ...args) => (i18n ? i18n.t(text, ...args) : String(text).replace(/\{(\d+)\}/g, (_, i) => args[i]));
    const asTab = location.hash === '#tab';
    document.body.classList.toggle('as-tab', asTab);
    const isFirefox = typeof globalThis.browser !== 'undefined' && typeof globalThis.browser?.runtime?.getBrowserInfo === 'function';

    let settings = await settingsApi.getSettings();
    if (i18n) {
        i18n.setLanguage(settings.ui?.language);
        i18n.translateDom(document);
    }
    let saveTimer = 0;
    let startupEventsReported = false;

    refs.versionPill.textContent = 'v' + (manifest.version || 'unknown');
    refs.buildStatus.textContent = String(buildConfig.buildChannel || 'local') + ' / ' + String(buildConfig.buildId || 'local-dev').slice(0, 8);
    refs.buildStatus.title = refs.buildStatus.textContent;
    const configuredTelegramChannelLink = String(buildConfig.telegramChannelLink || buildConfig.telegramLink || '').trim();
    refs.telegramChannelLink.href = configuredTelegramChannelLink || '#';
    refs.telegramChannelLink.classList.toggle('hidden', !configuredTelegramChannelLink);
    refs.mainLogo?.addEventListener('error', () => {
        refs.mainLogo.src = '../../logo_main.png';
    });

    function defaultMoodleUrl() {
        return buildConfig.moodleApiBaseUrl || settingsApi.DEFAULT_SETTINGS.backend.moodle.apiBaseUrl;
    }

    function setRadio(name, value) {
        Array.from(document.getElementsByName(name)).forEach((radio) => {
            radio.checked = radio.value === value;
        });
    }

    function radioValue(name, fallback) {
        const checked = Array.from(document.getElementsByName(name)).find((radio) => radio.checked);
        return checked ? checked.value : fallback;
    }

    function sendToActiveTab(message) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs && tabs[0] ? tabs[0].id : null;
            if (!tabId) {
                return;
            }
            chrome.tabs.sendMessage(tabId, message, () => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    return;
                }
            });
        });
    }

    let backendState = null;

    function renderHeaderStatus() {
        const accepted = Boolean(settings.onboarding?.privacyAccepted);
        let text = t('Нужно согласие');
        let cls = '';
        if (accepted) {
            if (backendState === true) {
                text = t('Сервер онлайн');
                cls = 'online';
            } else if (backendState === false) {
                text = t('Сервер недоступен');
                cls = 'offline';
            } else {
                text = t('Проверяем сервер…');
                cls = 'busy';
            }
        }
        refs.headerStatus.textContent = text;
        refs.headerDot.className = 'dot' + (cls ? ' ' + cls : '');
    }

    function showScreen(name) {
        refs.privacyScreen.classList.toggle('hidden', name !== 'privacy');
        refs.appScreen.classList.toggle('hidden', name !== 'app');
        renderHeaderStatus();
    }

    // --- Tabs ---
    const TAB_KEY = 'moodl0PopupTab';
    const tabButtons = Array.from(document.querySelectorAll('.tab[data-tab]'));
    const tabPanels = Array.from(document.querySelectorAll('.tab-panel[data-panel]'));

    function selectTab(name, remember) {
        if (!tabButtons.some((button) => button.dataset.tab === name)) {
            name = 'solve';
        }
        tabButtons.forEach((button) => {
            const active = button.dataset.tab === name;
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        tabPanels.forEach((panel) => {
            panel.hidden = panel.dataset.panel !== name;
        });
        if (remember) {
            try {
                localStorage.setItem(TAB_KEY, name);
            } catch (_) {
                // Tab memory is a convenience only.
            }
        }
    }

    tabButtons.forEach((button, index) => {
        button.addEventListener('click', () => selectTab(button.dataset.tab, true));
        button.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
                return;
            }
            const step = event.key === 'ArrowRight' ? 1 : -1;
            const next = tabButtons[(index + step + tabButtons.length) % tabButtons.length];
            selectTab(next.dataset.tab, true);
            next.focus();
        });
    });
    document.querySelectorAll('[data-goto]').forEach((link) => {
        link.addEventListener('click', () => {
            selectTab(link.dataset.goto, true);
            const target = link.dataset.goto === 'settings' ? refs.wandKey : null;
            target?.focus();
        });
    });

    let initialTab = 'solve';
    try {
        initialTab = localStorage.getItem(TAB_KEY) || 'solve';
    } catch (_) {
        initialTab = 'solve';
    }
    selectTab(initialTab, false);

    // --- Hotkeys shown in a readable form; the raw value stays in data-value ---
    function prettyHotkey(value) {
        const raw = String(value || '').trim();
        if (!raw) {
            return '';
        }
        return raw.split('+').map((part) => {
            if (/^Key[A-Z]$/.test(part)) {
                return part.slice(3);
            }
            if (/^Digit\d$/.test(part)) {
                return part.slice(5);
            }
            const names = { Escape: 'Esc', Control: 'Ctrl', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Backquote: '`' };
            return names[part] || part;
        }).join(' + ');
    }

    function setHotkeyInput(input, value) {
        input.dataset.value = value || '';
        input.value = prettyHotkey(value);
    }

    function hotkeyValue(input) {
        return String(input.dataset.value || '').trim();
    }

    const MODE_HINTS = {
        wand: 'Рядом с вопросом появляется палочка: нажмите её, чтобы увидеть рекомендации и статистику ответов и вставить нужный вручную.',
        autoInsert: 'Лучший ответ (по уверенности и статистике) вставляется сам, но страницы вы листаете и отправляете вручную.',
        highlight: 'Ничего не вставляется: лучший ответ подсвечивается зелёным прямо в вопросе, выбираете вы сами.',
        autoSolve: 'Расширение само вставляет ответы и переходит по страницам. Нажмите «Старт» на странице теста.'
    };

    function setNumberInput(input, value) {
        if (document.activeElement !== input) {
            input.value = String(Number(value) || 0);
        }
    }

    function route() {
        const accepted = Boolean(settings.onboarding?.privacyAccepted);
        showScreen(accepted ? 'app' : 'privacy');
    }

    function updateModeVisibility() {
        const moodleMode = radioValue('moodleMode', settings.moodle.mode);
        const running = Boolean(settings.moodle.autoSolving);
        refs.modeHint.textContent = t(MODE_HINTS[moodleMode] || '');
        refs.autoSolveControls.classList.toggle('hidden', moodleMode !== 'autoSolve');
        refs.moodleAutoInsertRow.classList.toggle('hidden', moodleMode !== 'autoInsert');
        refs.moodleAutoFinishRow.classList.toggle('hidden', moodleMode !== 'autoSolve');
        refs.moodleAutoSubmitRow.classList.toggle('hidden', moodleMode !== 'autoSolve' || !refs.moodleAutoFinishAttempt.checked);
        refs.confirmBeforeSubmitRow.classList.toggle('hidden', moodleMode !== 'autoSolve'
            || !refs.moodleAutoFinishAttempt.checked || !refs.moodleAutoSubmitAttempt.checked);
        refs.thresholdBlock.classList.toggle('hidden', moodleMode === 'wand');
        refs.delayBlock.classList.toggle('hidden', moodleMode !== 'autoSolve');
        refs.btnStart.classList.toggle('hidden', running);
        refs.btnStop.classList.toggle('hidden', !running);
        refs.autoSolveState.textContent = running ? t('Работает') : t('Остановлено');
        refs.autoSolveDot.className = 'dot' + (running ? ' running' : '');
    }

    function getMoodleBackendUiState() {
        const moodleBackend = settings.backend.moodle || {};
        const defaultUrl = defaultMoodleUrl();
        const currentUrl = String(moodleBackend.apiBaseUrl || '').trim();

        return {
            apiBaseUrl: currentUrl || defaultUrl,
            isCustom: Boolean(currentUrl && currentUrl !== defaultUrl)
        };
    }

    function applyStateToUi() {
        const moodleBackend = settings.backend.moodle || {};
        const uiBackend = getMoodleBackendUiState();
        refs.backendApiBaseUrl.value = uiBackend.apiBaseUrl;
        refs.backendRequestTimeoutMs.value = String(moodleBackend.requestTimeoutMs || 4000);
        refs.customBackendToggle.checked = uiBackend.isCustom;
        refs.customBackendFields.classList.toggle('hidden', !uiBackend.isCustom);

        setRadio('moodleMode', settings.moodle.mode);
        setHotkeyInput(refs.wandKey, settings.moodle.wandHotkey);
        refs.moodleAutoInsertOnLoad.checked = settings.moodle.autoInsertOnLoad !== false;
        setHotkeyInput(refs.moodleInsertKey, settings.moodle.insertHotkey);
        refs.wandKeyHint.textContent = prettyHotkey(settings.moodle.wandHotkey) || '—';
        refs.insertKeyHint.textContent = prettyHotkey(settings.moodle.insertHotkey) || '—';
        refs.nextBtnSelector.value = settings.moodle.nextButtonText;
        refs.moodleAutoFinishAttempt.checked = Boolean(settings.moodle.autoFinishAttempt);
        refs.moodleAutoSubmitAttempt.checked = Boolean(settings.moodle.autoSubmitAttempt);
        refs.confirmBeforeSubmit.checked = settings.moodle.confirmBeforeSubmit !== false;
        setNumberInput(refs.minConfidence, settings.moodle.minConfidence);
        setNumberInput(refs.minVotes, settings.moodle.minVotes);
        setNumberInput(refs.pageDelayMin, settings.moodle.pageDelayMin);
        setNumberInput(refs.pageDelayMax, settings.moodle.pageDelayMax);
        refs.notifyQueue.checked = settings.moodle.notifyQueue !== false;
        refs.uiLanguage.value = settings.ui?.language || 'auto';
        updateModeVisibility();
        route();
    }

    function collectStateFromUi() {
        const next = JSON.parse(JSON.stringify(settings));
        next.ui = next.ui || {};
        next.ui.lastTab = 'moodle';
        next.activePlatform = 'moodle';
        next.onboarding = next.onboarding || {};
        next.onboarding.moodleOnly = true;
        next.onboarding.privacyAccepted = Boolean(next.onboarding.privacyAccepted);
        next.onboarding.completed = Boolean(next.onboarding.privacyAccepted);

        next.backend = next.backend || {};
        next.backend.moodle = next.backend.moodle || {};
        if (refs.customBackendToggle.checked) {
            const customUrl = refs.backendApiBaseUrl.value.trim().replace(/\/$/, '');
            if (customUrl) {
                next.backend.moodle.apiBaseUrl = customUrl;
            }
        } else {
            next.backend.moodle.apiBaseUrl = defaultMoodleUrl();
        }
        next.backend.moodle.requestTimeoutMs = Math.max(1000, Number(refs.backendRequestTimeoutMs.value || next.backend.moodle.requestTimeoutMs || 4000));

        next.moodle.mode = radioValue('moodleMode', next.moodle.mode);
        next.moodle.wandHotkey = hotkeyValue(refs.wandKey) || next.moodle.wandHotkey;
        next.moodle.autoInsertOnLoad = refs.moodleAutoInsertOnLoad.checked;
        next.moodle.insertHotkey = hotkeyValue(refs.moodleInsertKey) || next.moodle.insertHotkey;
        next.moodle.nextButtonText = refs.nextBtnSelector.value.trim() || next.moodle.nextButtonText;
        next.moodle.autoFinishAttempt = refs.moodleAutoFinishAttempt.checked;
        next.moodle.autoSubmitAttempt = refs.moodleAutoSubmitAttempt.checked;
        next.moodle.confirmBeforeSubmit = refs.confirmBeforeSubmit.checked;
        next.moodle.minConfidence = Number(refs.minConfidence.value) || 0;
        next.moodle.minVotes = Number(refs.minVotes.value) || 0;
        next.moodle.pageDelayMin = Number(refs.pageDelayMin.value) || 0;
        next.moodle.pageDelayMax = Number(refs.pageDelayMax.value) || 0;
        next.moodle.notifyQueue = refs.notifyQueue.checked;
        next.ui.language = refs.uiLanguage.value || 'auto';

        return settingsApi.normalizeSettings(next);
    }

    async function persistSettings(next, reason) {
        settings = settingsApi.normalizeSettings(next);
        settings = await settingsApi.saveSettings(settings);
        sendToActiveTab({ type: 'SETTINGS_UPDATED', settings, reason: reason || 'popup' });
        applyStateToUi();
    }

    let savedFlashTimer = 0;

    function flashSaved() {
        refs.btnSave.textContent = t('Сохранено ✓');
        refs.btnSave.classList.add('saved');
        clearTimeout(savedFlashTimer);
        savedFlashTimer = setTimeout(() => {
            refs.btnSave.textContent = t('Изменения сохраняются автоматически');
            refs.btnSave.classList.remove('saved');
        }, 1600);
    }

    async function save(reason) {
        settings = collectStateFromUi();
        await persistSettings(settings, reason);
        flashSaved();
    }

    function telemetryAllowed() {
        return Boolean(settings.onboarding?.privacyAccepted && settings.onboarding?.allowTechnicalDataCollection !== false);
    }

    function eventStorageKey(name) {
        return 'paramExtExtensionEvent:' + name;
    }

    async function reportExtensionEvent(eventName, onceKey) {
        if (!telemetryAllowed()) {
            return;
        }
        try {
            if (onceKey && localStorage.getItem(eventStorageKey(onceKey))) {
                return;
            }
        } catch (_) {
            return;
        }

        const baseUrl = normalizeUrl(settings.backend?.moodle?.apiBaseUrl || defaultMoodleUrl());
        if (!baseUrl) {
            return;
        }

        const payload = {
            eventName,
            extensionVersion: manifest.version || 'unknown',
            buildId: String(buildConfig.buildId || 'local-dev'),
            channel: String(buildConfig.buildChannel || 'local'),
            platform: 'moodle',
            authMode: settings.backend?.moodle?.apiToken ? 'moodle-token' : 'anonymous'
        };

        try {
            const response = await fetch(baseUrl + '/v2/extension/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                cache: 'no-store'
            });
            if (response.ok && onceKey) {
                localStorage.setItem(eventStorageKey(onceKey), new Date().toISOString());
            }
        } catch (_) {
            // Anonymous counters are best-effort only.
        }
    }

    function normalizeUrl(value) {
        return String(value || '').trim().replace(/\/$/, '');
    }

    function reportStartupEvents() {
        if (!telemetryAllowed()) {
            return;
        }
        if (startupEventsReported) {
            return;
        }
        startupEventsReported = true;
        const today = new Date().toISOString().slice(0, 10);
        reportExtensionEvent('extension_installed', 'install-v1');
        reportExtensionEvent('popup_opened', 'popup-opened-' + today);
    }

    function scheduleAppSave(reason) {
        if (saveTimer) {
            clearTimeout(saveTimer);
        }
        saveTimer = setTimeout(() => {
            saveTimer = 0;
            save(reason);
        }, 250);
    }

    function setBackendStatus(text, ok) {
        backendState = ok;
        renderHeaderStatus();
        refs.backendPingStatus.textContent = text;
        refs.backendCompactStatus.textContent = text;
        [refs.backendPingStatus, refs.backendCompactStatus].forEach((node) => {
            node.classList.toggle('online', ok === true);
            node.classList.toggle('offline', ok === false);
        });
    }

    async function pingBackend() {
        setBackendStatus(t('Проверка...'), null);
        const baseUrl = (refs.customBackendToggle.checked ? refs.backendApiBaseUrl.value : defaultMoodleUrl()).trim().replace(/\/$/, '');
        if (!baseUrl) {
            setBackendStatus(t('URL пустой'), false);
            return false;
        }
        try {
            const response = await fetch(baseUrl + '/v2/status', {
                cache: 'no-store'
            });
            const ok = response.ok || response.status === 401 || response.status === 403;
            setBackendStatus(ok ? t('Онлайн') : t('Ошибка ') + response.status, ok);
            return ok;
        } catch (_) {
            setBackendStatus(t('Оффлайн'), false);
            return false;
        }
    }

    async function checkUpdate() {
        const baseUrl = settings.backend.moodle.apiBaseUrl || defaultMoodleUrl();
        const url = (buildConfig.updateCheckUrl || (baseUrl + '/v2/update'))
            + '?version=' + encodeURIComponent(manifest.version || '')
            + '&build_id=' + encodeURIComponent(buildConfig.buildId || '');
        refs.updateStatus.textContent = t('Проверка...');
        refs.updateStatus.classList.remove('online', 'offline');
        try {
            const response = await fetch(url, { cache: 'no-store' });
            const data = await response.json();
            const isNewer = (latest, current) => {
                const a = String(latest || '').split('.').map((n) => parseInt(n, 10) || 0);
                const b = String(current || '').split('.').map((n) => parseInt(n, 10) || 0);
                for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
                    if ((a[i] || 0) !== (b[i] || 0)) {
                        return (a[i] || 0) > (b[i] || 0);
                    }
                }
                return false;
            };
            // The server may answer for upstream SyncShare (e.g. 1.x); never offer a downgrade.
            if (data.updateRequired && (!data.latestVersion || isNewer(data.latestVersion, manifest.version))) {
                refs.updateStatus.textContent = t('Доступна ') + (data.latestVersion || t('новая'));
                refs.updateStatus.classList.add('offline');
            } else {
                refs.updateStatus.textContent = t('Актуально');
                refs.updateStatus.classList.add('online');
            }
        } catch (_) {
            refs.updateStatus.textContent = t('Ошибка');
            refs.updateStatus.classList.add('offline');
        }
    }

    async function refreshProjectVersion() {
        const baseUrl = settings.backend.moodle.apiBaseUrl || defaultMoodleUrl();
        if (!baseUrl) {
            return;
        }

        try {
            const response = await fetch(baseUrl + '/v2/version', { cache: 'no-store' });
            if (!response.ok) {
                return;
            }
            const data = await response.json();
            const projectVersion = data.projectVersion || data.latestVersion || '';
            if (projectVersion) {
                refs.versionPill.textContent = 'v' + projectVersion;
            }
        } catch (_) {
            refs.versionPill.textContent = 'v' + (manifest.version || 'unknown');
        }
    }

    function bindHotkey(input) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                return;
            }
            event.preventDefault();
            if ((event.key === 'Backspace' || event.key === 'Delete') && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
                setHotkeyInput(input, '');
                scheduleAppSave('hotkey-clear');
                return;
            }
            const value = settingsApi.serializeHotkey(event);
            if (value) {
                setHotkeyInput(input, value);
                scheduleAppSave('hotkey');
            }
        });
    }

    refs.openPrivacyBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'PARAMEXT_OPEN_PRIVACY_POLICY' }, () => {});
    });
    refs.refreshPrivacyBtn.addEventListener('click', async () => {
        settings = await settingsApi.getSettings();
        applyStateToUi();
    });
    refs.customBackendToggle.addEventListener('change', () => {
        if (!refs.customBackendToggle.checked) {
            refs.backendApiBaseUrl.value = defaultMoodleUrl();
        }
        refs.customBackendFields.classList.toggle('hidden', !refs.customBackendToggle.checked);
        scheduleAppSave('backend-toggle');
    });
    refs.backendApiBaseUrl.addEventListener('input', () => {
        if (refs.customBackendToggle.checked) {
            scheduleAppSave('backend-url');
        }
    });
    refs.backendRequestTimeoutMs.addEventListener('input', () => {
        scheduleAppSave('backend-timeout');
    });
    refs.backendResetUrlBtn.addEventListener('click', () => {
        refs.customBackendToggle.checked = false;
        refs.backendApiBaseUrl.value = defaultMoodleUrl();
        refs.customBackendFields.classList.add('hidden');
        setBackendStatus(t('Не проверено'), null);
        scheduleAppSave('backend-reset');
    });
    refs.updateCheckBtn.addEventListener('click', checkUpdate);
    refs.btnStart.addEventListener('click', async () => {
        settings.moodle.autoSolving = true;
        await save('moodle-start');
        sendToActiveTab({ type: 'START_AUTO_SOLVE' });
    });
    refs.btnStop.addEventListener('click', async () => {
        settings.moodle.autoSolving = false;
        await save('moodle-stop');
        sendToActiveTab({ type: 'STOP_AUTO_SOLVE' });
    });

    async function showMoodleQueueStatus() {
        const result = await chrome.storage.local.get('paramExtMoodleQueue');
        const queue = result.paramExtMoodleQueue;
        const stages = { view: 'открываем тест', starting: 'запускаем попытку', attempt: 'решаем вопросы', submitted: 'ожидаем результат' };
        const total = queue?.links?.length || 0;
        const finished = Boolean(queue && !queue.active && total && queue.index === total);
        refs.moodleQueueStatus.textContent = queue?.active
            ? t('Тест {0} из {1} — {2}', queue.index + 1, total, t(stages[queue.stage] || 'ожидаем'))
            : (queue?.error ? t('Тест {0} из {1}: {2}', queue.index + 1, total, t(queue.error))
                : (!queue ? t('Очередь не запущена') : (finished ? t('Готово: пройдено {0} из {1}', total, total) : t('Очередь остановлена'))));
        const canResume = Boolean(queue && !queue.active && total && queue.index < total);
        refs.moodleQueueResume.classList.toggle('hidden', !canResume);
        if (canResume) {
            refs.moodleQueueResume.textContent = t('↻ Продолжить с теста {0}', queue.index + 1);
        }
        resumableQueue = canResume ? queue : null;
        refs.queueStatusBox.classList.toggle('active', Boolean(queue?.active) || finished);
        refs.queueStatusBox.classList.toggle('error', Boolean(!queue?.active && queue?.error));
        const showProgress = Boolean(total && (queue.active || finished));
        refs.queueProgress.classList.toggle('hidden', !showProgress);
        if (showProgress) {
            const done = queue.active ? queue.index + (queue.stage === 'submitted' ? 1 : 0.5) : total;
            refs.queueProgressBar.style.width = Math.min(100, Math.round((done / total) * 100)) + '%';
        }
        refs.moodleQueueStart.classList.toggle('hidden', Boolean(queue?.active));
        refs.moodleQueueStop.classList.toggle('hidden', !queue?.active);
        refs.queueCountBadge.classList.toggle('live', Boolean(queue?.active));
        refs.queueCountBadge.textContent = queue?.active ? `${queue.index + 1}/${total}` : String(collectedLinks.length);
        refs.queueCountBadge.classList.toggle('empty', !queue?.active && !collectedLinks.length);
        runningQueue = queue?.active ? queue : null;
        highlightRunningLink();
        return queue;
    }

    let runningQueue = null;
    let resumableQueue = null;

    function highlightRunningLink() {
        Array.from(refs.moodleQueueList.children).forEach((item) => {
            const href = item.dataset.href;
            const pos = runningQueue && href ? runningQueue.links.indexOf(href) : -1;
            item.classList.toggle('current', pos >= 0 && pos === runningQueue.index);
            item.classList.toggle('done', pos >= 0 && pos < runningQueue.index);
        });
    }

    function describeQuizLink(href) {
        try {
            const url = new URL(href);
            return { host: url.host, id: url.searchParams.get('id') || '' };
        } catch (_) {
            return { host: href, id: '' };
        }
    }

    const QUEUE_DRAFT_KEY = 'paramExtMoodleQueueDraft';
    let collectedLinks = [];

    function parseQuizLink(line) {
        const url = new URL(line);
        if (!/^https?:$/.test(url.protocol) || !/\/mod\/quiz\/view\.php$/.test(url.pathname)
            || !/^\d+$/.test(url.searchParams.get('id') || '')) {
            throw new Error(t('Некорректная ссылка: ') + line);
        }
        url.hash = '';
        return url.href;
    }

    function addLinksToCollection(lines) {
        const fresh = [];
        let skipped = 0;
        for (const line of lines) {
            try {
                const href = parseQuizLink(line);
                if (collectedLinks.includes(href) || fresh.includes(href)) {
                    skipped += 1;
                    continue;
                }
                fresh.push(href);
            } catch (_) {
                throw new Error(t('Некорректная ссылка: ') + line);
            }
        }
        if (!fresh.length) {
            return { added: 0, skipped };
        }
        const all = collectedLinks.concat(fresh);
        const origin = new URL(all[0]).origin;
        if (!all.every((href) => new URL(href).origin === origin)) {
            throw new Error(t('Нужны ссылки на тесты одного сайта.'));
        }
        collectedLinks = all;
        return { added: fresh.length, skipped };
    }

    async function persistCollectedLinks() {
        await chrome.storage.local.set({ [QUEUE_DRAFT_KEY]: collectedLinks });
        renderCollectedLinks();
    }

    function renderCollectedLinks() {
        refs.moodleQueueList.innerHTML = '';
        refs.queueCountLabel.textContent = String(collectedLinks.length);
        if (!runningQueue) {
            refs.queueCountBadge.textContent = String(collectedLinks.length);
            refs.queueCountBadge.classList.toggle('empty', !collectedLinks.length);
        }
        if (!collectedLinks.length) {
            const empty = document.createElement('li');
            empty.className = 'queue-empty';
            empty.textContent = t('Пока пусто — вставьте ссылки или добавьте текущую вкладку');
            refs.moodleQueueList.appendChild(empty);
            return;
        }
        collectedLinks.forEach((href, index) => {
            const item = document.createElement('li');
            item.dataset.href = href;
            const num = document.createElement('span');
            num.className = 'q-num';
            num.textContent = String(index + 1);
            const label = document.createElement('span');
            label.className = 'q-url';
            const info = describeQuizLink(href);
            const host = document.createElement('i');
            host.textContent = info.host + ' · ';
            const id = document.createElement('b');
            id.textContent = info.id ? t('тест #') + info.id : href;
            label.append(host, id);
            label.title = href;
            item.appendChild(num);
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = '×';
            remove.title = t('Убрать из списка');
            remove.setAttribute('aria-label', t('Убрать ссылку ') + (index + 1));
            remove.addEventListener('click', async () => {
                collectedLinks.splice(index, 1);
                await persistCollectedLinks();
            });
            item.appendChild(label);
            item.appendChild(remove);
            refs.moodleQueueList.appendChild(item);
        });
        highlightRunningLink();
    }

    async function loadCollectedLinks() {
        try {
            const stored = (await chrome.storage.local.get(QUEUE_DRAFT_KEY))[QUEUE_DRAFT_KEY];
            collectedLinks = Array.isArray(stored)
                ? stored.filter((href) => {
                    try {
                        return parseQuizLink(String(href)) === String(href);
                    } catch (_) {
                        return false;
                    }
                })
                : [];
        } catch (_) {
            collectedLinks = [];
        }
        renderCollectedLinks();
    }

    refs.moodleQueueAddText.addEventListener('click', async () => {
        const lines = refs.moodleQueueTextarea.value.split(/\r?\n/).map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));
        if (!lines.length) {
            refs.moodleQueueStatus.textContent = t('Вставьте ссылки в поле выше.');
            return;
        }
        try {
            const { added, skipped } = addLinksToCollection(lines);
            await persistCollectedLinks();
            refs.moodleQueueTextarea.value = '';
            refs.moodleQueueStatus.textContent = added > 0
                ? t('Добавлено: {0} из {1}', added, lines.length) + (skipped ? t(' (дубли пропущены: {0})', skipped) : '') + t('. Всего в списке: {0}.', collectedLinks.length)
                : t('Все эти ссылки уже есть в списке.');
        } catch (error) {
            refs.moodleQueueStatus.textContent = error.message;
        }
    });

    refs.moodleQueueAddCurrent.addEventListener('click', async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tabs[0]?.url || '';
        if (!url || !/^https?:/.test(url)) {
            refs.moodleQueueStatus.textContent = t('Не удалось прочитать адрес текущей вкладки.');
            return;
        }
        const clean = url.split('#')[0];
        try {
            const { added } = addLinksToCollection([clean]);
            await persistCollectedLinks();
            refs.moodleQueueStatus.textContent = added > 0
                ? t('Текущая вкладка добавлена. Всего в списке: {0}.', collectedLinks.length)
                : t('Эта вкладка уже есть в списке.');
        } catch (_) {
            refs.moodleQueueStatus.textContent = t('Текущая вкладка — не страница теста Moodle (нужна ссылка вида …/mod/quiz/view.php?id=...).');
        }
    });

    refs.moodleQueueImportBtn.addEventListener('click', () => {
        // Firefox closes the popup when a file picker opens; use a tab there.
        if (isFirefox && !asTab) {
            openAsTab();
            return;
        }
        refs.moodleQueueFile.click();
    });

    refs.moodleQueueFile.addEventListener('change', async () => {
        const file = refs.moodleQueueFile.files?.[0];
        refs.moodleQueueFile.value = '';
        if (!file) {
            return;
        }
        if (!/\.txt$/i.test(file.name)) {
            refs.moodleQueueStatus.textContent = t('Нужен файл .txt.');
            return;
        }
        const lines = (await file.text()).split(/\r?\n/).map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));
        if (!lines.length) {
            refs.moodleQueueStatus.textContent = t('В файле нет ссылок.');
            return;
        }
        try {
            const { added, skipped } = addLinksToCollection(lines);
            await persistCollectedLinks();
            refs.moodleQueueStatus.textContent = added > 0
                ? t('Импортировано: {0} из {1}', added, lines.length) + (skipped ? t(' (дубли пропущены: {0})', skipped) : '') + t('. Всего в списке: {0}.', collectedLinks.length)
                : t('Все ссылки из файла уже есть в списке.');
        } catch (error) {
            refs.moodleQueueStatus.textContent = error.message;
        }
    });

    refs.moodleQueueTextarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            refs.moodleQueueAddText.click();
        }
    });

    let clearConfirmTimer = 0;
    refs.moodleQueueClear.addEventListener('click', async () => {
        if (!collectedLinks.length) {
            return;
        }
        if (!clearConfirmTimer) {
            refs.moodleQueueClear.textContent = t('Точно очистить?');
            clearConfirmTimer = setTimeout(() => {
                clearConfirmTimer = 0;
                refs.moodleQueueClear.textContent = t('Очистить');
            }, 3000);
            return;
        }
        clearTimeout(clearConfirmTimer);
        clearConfirmTimer = 0;
        refs.moodleQueueClear.textContent = t('Очистить');
        collectedLinks = [];
        await persistCollectedLinks();
        await showMoodleQueueStatus();
    });

    refs.moodleQueueStart.addEventListener('click', () => {
        const links = collectedLinks.slice();
        if (!links.length) {
            refs.moodleQueueStatus.textContent = t('Список пуст — добавьте ссылки выше или импортируйте .txt.');
            return;
        }
        launchQueue(links, 0);
    });

    refs.moodleQueueResume.addEventListener('click', () => {
        if (resumableQueue) {
            launchQueue(resumableQueue.links.slice(), resumableQueue.index, resumableQueue.runId);
        }
    });

    async function launchQueue(links, startIndex, runId) {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = 0;
        }
        await save('moodle-queue-start');
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
            refs.moodleQueueStatus.textContent = t('Не найдена активная вкладка');
            return;
        }
        const index = Math.max(0, Math.min(links.length - 1, Number(startIndex) || 0));
        try {
            const key = 'paramExtMoodleQueue';
            const previous = (await chrome.storage.local.get(key))[key];
            if (previous?.active && (previous.tabId !== tabs[0].id || previous.attemptId || previous.stage === 'submitted')) {
                refs.moodleQueueStatus.textContent = t('Очередь уже обрабатывает попытку. Остановите её перед новым запуском.');
                return;
            }
            const launchToken = crypto.randomUUID();
            const queue = { active: true, tabId: tabs[0].id, links, index, attemptId: null,
                stage: 'view', origin: new URL(links[0]).origin, launchToken, error: '',
                runId: runId || crypto.randomUUID() };
            await chrome.storage.local.set({ [key]: queue });
            refs.moodleQueueStatus.textContent = t('Запущено: {0} из {1}', index + 1, links.length);
            const destination = new URL(links[index]);
            destination.hash = 'moodl0-queue=' + launchToken;
            await chrome.tabs.update(queue.tabId, { url: destination.href, active: true });
        } catch (error) {
            const key = 'paramExtMoodleQueue';
            const queue = (await chrome.storage.local.get(key))[key];
            if (queue?.active && queue.tabId === tabs[0].id && queue.links[index] === links[index]) {
                await chrome.storage.local.set({ [key]: { ...queue, active: false, error: String(error.message || error) } });
            }
            refs.moodleQueueStatus.textContent = error.message || t('Не удалось открыть тест');
        }
    }

    // --- Collect every quiz link from the open course page ---
    refs.moodleQueueAddPage.addEventListener('click', async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (!tabId || !/^https?:/.test(tabs[0]?.url || '')) {
            refs.moodleQueueStatus.textContent = t('Откройте страницу курса Moodle в текущей вкладке.');
            return;
        }
        let hrefs = [];
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => Array.from(document.querySelectorAll('a[href*="/mod/quiz/view.php"]')).map((a) => a.href)
            });
            hrefs = Array.isArray(results?.[0]?.result) ? results[0].result : [];
        } catch (_) {
            refs.moodleQueueStatus.textContent = t('Не удалось прочитать страницу.');
            return;
        }
        const clean = [];
        hrefs.forEach((href) => {
            try {
                const url = new URL(href);
                const id = url.searchParams.get('id');
                if (/\/mod\/quiz\/view\.php$/.test(url.pathname) && /^\d+$/.test(id || '')) {
                    const normalized = url.origin + url.pathname + '?id=' + id;
                    if (!clean.includes(normalized)) {
                        clean.push(normalized);
                    }
                }
            } catch (_) {
                // Skip broken links.
            }
        });
        if (!clean.length) {
            refs.moodleQueueStatus.textContent = t('На этой странице нет ссылок на тесты.');
            return;
        }
        try {
            const { added, skipped } = addLinksToCollection(clean);
            await persistCollectedLinks();
            refs.moodleQueueStatus.textContent = added > 0
                ? t('Найдено тестов: {0}, добавлено: {1}. Всего в списке: {2}.', clean.length, added, collectedLinks.length)
                : t('Все {0} тестов со страницы уже в списке.', skipped);
        } catch (error) {
            refs.moodleQueueStatus.textContent = error.message;
        }
    });

    // --- History ---
    const HISTORY_KEY = 'paramExtMoodleHistory';

    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleString(i18n && i18n.language() === 'en' ? 'en-GB' : 'ru-RU',
                { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch (_) {
            return '';
        }
    }

    async function renderHistory() {
        let list = [];
        try {
            const stored = (await chrome.storage.local.get(HISTORY_KEY))[HISTORY_KEY];
            list = Array.isArray(stored) ? stored : [];
        } catch (_) {
            list = [];
        }
        refs.historyCount.textContent = String(list.length);
        refs.historyCount.classList.toggle('empty', !list.length);
        refs.historyList.innerHTML = '';
        if (!list.length) {
            const empty = document.createElement('li');
            empty.className = 'h-empty';
            empty.textContent = t('Пока пусто — здесь появятся пройденные тесты');
            refs.historyList.appendChild(empty);
            return;
        }
        list.slice(0, 50).forEach((entry) => {
            const li = document.createElement('li');
            const mark = document.createElement('span');
            mark.className = 'h-mark ' + (entry.status === 'done' ? 'ok' : 'err');
            mark.textContent = entry.status === 'done' ? '✓' : '!';
            const main = document.createElement('span');
            main.className = 'h-main';
            const info = describeQuizLink(entry.url || '');
            main.textContent = entry.name || (info.id ? t('тест #') + info.id : (entry.url || '—'));
            main.title = entry.url || '';
            const sub = document.createElement('small');
            sub.textContent = formatTime(entry.at) + (entry.status !== 'done' && entry.error ? ' · ' + t(entry.error) : '');
            main.appendChild(sub);
            const side = document.createElement('span');
            side.className = 'h-side';
            side.textContent = entry.status === 'done' ? (entry.grade || '—') : t('ошибка');
            li.append(mark, main, side);
            refs.historyList.appendChild(li);
        });
    }

    let historyClearTimer = 0;
    refs.historyClear.addEventListener('click', async () => {
        if (!historyClearTimer) {
            refs.historyClear.textContent = t('Точно очистить?');
            historyClearTimer = setTimeout(() => {
                historyClearTimer = 0;
                refs.historyClear.textContent = t('Очистить историю');
            }, 3000);
            return;
        }
        clearTimeout(historyClearTimer);
        historyClearTimer = 0;
        refs.historyClear.textContent = t('Очистить историю');
        await chrome.storage.local.set({ [HISTORY_KEY]: [] });
        renderHistory();
    });

    // --- Export / import settings + queue draft ---
    function openAsTab() {
        chrome.tabs.create({ url: chrome.runtime.getURL('html/popup/popup_new.html#tab') });
        window.close();
    }

    refs.exportBtn.addEventListener('click', async () => {
        const payload = {
            format: 'moodl0-settings',
            version: 1,
            extensionVersion: manifest.version || '',
            exportedAt: new Date().toISOString(),
            settings: collectStateFromUi(),
            queueDraft: collectedLinks.slice()
        };
        // Never move the backend token between machines by accident.
        if (payload.settings.backend?.moodle) {
            payload.settings.backend.moodle.apiToken = '';
        }
        payload.settings.moodle.autoSolving = false;
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'moodl0-settings-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        refs.transferStatus.textContent = t('Файл настроек сохранён.');
    });

    refs.importBtn.addEventListener('click', () => {
        if (isFirefox && !asTab) {
            openAsTab();
            return;
        }
        refs.importFile.click();
    });

    refs.importFile.addEventListener('change', async () => {
        const file = refs.importFile.files?.[0];
        refs.importFile.value = '';
        if (!file) {
            return;
        }
        try {
            const data = JSON.parse(await file.text());
            if (!data || data.format !== 'moodl0-settings' || typeof data.settings !== 'object') {
                throw new Error('bad-format');
            }
            const incoming = settingsApi.normalizeSettings(data.settings);
            // Keep this machine's consent and backend token.
            incoming.onboarding = settings.onboarding;
            incoming.backend.moodle.apiToken = settings.backend?.moodle?.apiToken || '';
            incoming.moodle.autoSolving = false;
            await persistSettings(incoming, 'import');
            if (Array.isArray(data.queueDraft)) {
                collectedLinks = [];
                try {
                    addLinksToCollection(data.queueDraft.map(String));
                } catch (_) {
                    collectedLinks = [];
                }
                await persistCollectedLinks();
            }
            applyLanguage();
            refs.transferStatus.textContent = t('Импортировано: настройки и {0} ссылок.', collectedLinks.length);
        } catch (_) {
            refs.transferStatus.textContent = t('Это не файл настроек MooDL0.');
        }
    });

    // --- Language ---
    function applyLanguage() {
        if (!i18n) {
            return;
        }
        i18n.setLanguage(settings.ui?.language);
        i18n.translateDom(document);
        refs.moodleQueueClear.textContent = t('Очистить');
        refs.historyClear.textContent = t('Очистить историю');
        refs.btnSave.textContent = t('Изменения сохраняются автоматически');
        updateModeVisibility();
        renderHeaderStatus();
        renderCollectedLinks();
        renderHistory();
        showMoodleQueueStatus();
    }

    refs.uiLanguage.addEventListener('change', async () => {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = 0;
        }
        await save('language');
        applyLanguage();
    });
    refs.moodleQueueStop.addEventListener('click', async () => {
        const key = 'paramExtMoodleQueue';
        const queue = (await chrome.storage.local.get(key))[key];
        if (queue?.active) {
            await chrome.storage.local.set({ [key]: { ...queue, active: false } });
        }
        await showMoodleQueueStatus();
    });
    await loadCollectedLinks();
    const initialQueue = await showMoodleQueueStatus();
    if (initialQueue?.active) {
        selectTab('queue', false);
    }
    renderHistory();
    chrome.storage.onChanged?.addListener((changes, area) => {
        if (area === 'local' && changes.paramExtMoodleQueue) {
            showMoodleQueueStatus();
        }
        if (area === 'local' && changes[HISTORY_KEY]) {
            renderHistory();
        }
    });

    [
        refs.nextBtnSelector,
        refs.moodleAutoInsertOnLoad,
        refs.moodleAutoFinishAttempt,
        refs.moodleAutoSubmitAttempt,
        refs.confirmBeforeSubmit,
        refs.minConfidence,
        refs.minVotes,
        refs.pageDelayMin,
        refs.pageDelayMax,
        refs.notifyQueue
    ].forEach((control) => {
        control.addEventListener(control.tagName === 'INPUT' && control.type !== 'checkbox' ? 'input' : 'change', () => {
            updateModeVisibility();
            scheduleAppSave(control.id || 'change');
        });
    });
    Array.from(document.getElementsByName('moodleMode')).forEach((radio) => radio.addEventListener('change', () => {
        updateModeVisibility();
        scheduleAppSave('moodle-mode');
    }));
    bindHotkey(refs.wandKey);
    bindHotkey(refs.moodleInsertKey);

    applyStateToUi();
    reportStartupEvents();
    refreshProjectVersion();
    pingBackend();
    checkUpdate();
});
