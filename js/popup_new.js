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
        headerStatus: $('headerStatus'),
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
        moodleQueueStart: $('moodleQueueStart'),
        moodleQueueStop: $('moodleQueueStop'),
        moodleQueueStatus: $('moodleQueueStatus'),
        updateCheckBtn: $('updateCheckBtn'),
        updateStatus: $('updateStatus'),
        buildStatus: $('buildStatus'),
        btnSave: $('btnSave')
    };

    let settings = await settingsApi.getSettings();
    let saveTimer = 0;
    let startupEventsReported = false;

    refs.versionPill.textContent = 'v' + (manifest.version || 'unknown');
    refs.buildStatus.textContent = String(buildConfig.buildChannel || 'local') + ' / ' + String(buildConfig.buildId || 'local-dev').slice(0, 8);
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

    function showScreen(name) {
        refs.privacyScreen.classList.toggle('hidden', name !== 'privacy');
        refs.appScreen.classList.toggle('hidden', name !== 'app');
        refs.headerStatus.textContent = name === 'privacy'
            ? 'Нужно согласие'
            : 'Готово к работе';
    }

    function route() {
        const accepted = Boolean(settings.onboarding?.privacyAccepted);
        showScreen(accepted ? 'app' : 'privacy');
    }

    function updateModeVisibility() {
        const moodleMode = radioValue('moodleMode', settings.moodle.mode);
        refs.autoSolveControls.classList.toggle('hidden', moodleMode !== 'autoSolve');
        refs.moodleAutoFinishRow.classList.toggle('hidden', moodleMode !== 'autoSolve');
        refs.moodleAutoSubmitRow.classList.toggle('hidden', moodleMode !== 'autoSolve' || !refs.moodleAutoFinishAttempt.checked);
        refs.btnStart.classList.toggle('hidden', Boolean(settings.moodle.autoSolving));
        refs.btnStop.classList.toggle('hidden', !settings.moodle.autoSolving);
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
        refs.wandKey.value = settings.moodle.wandHotkey;
        refs.moodleAutoInsertOnLoad.checked = settings.moodle.autoInsertOnLoad !== false;
        refs.moodleInsertKey.value = settings.moodle.insertHotkey;
        refs.nextBtnSelector.value = settings.moodle.nextButtonText;
        refs.moodleAutoFinishAttempt.checked = Boolean(settings.moodle.autoFinishAttempt);
        refs.moodleAutoSubmitAttempt.checked = Boolean(settings.moodle.autoSubmitAttempt);
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
        next.moodle.wandHotkey = refs.wandKey.value.trim() || next.moodle.wandHotkey;
        next.moodle.autoInsertOnLoad = refs.moodleAutoInsertOnLoad.checked;
        next.moodle.insertHotkey = refs.moodleInsertKey.value.trim() || next.moodle.insertHotkey;
        next.moodle.nextButtonText = refs.nextBtnSelector.value.trim() || next.moodle.nextButtonText;
        next.moodle.autoFinishAttempt = refs.moodleAutoFinishAttempt.checked;
        next.moodle.autoSubmitAttempt = refs.moodleAutoSubmitAttempt.checked;

        return settingsApi.normalizeSettings(next);
    }

    async function persistSettings(next, reason) {
        settings = settingsApi.normalizeSettings(next);
        settings = await settingsApi.saveSettings(settings);
        sendToActiveTab({ type: 'SETTINGS_UPDATED', settings, reason: reason || 'popup' });
        applyStateToUi();
    }

    async function save(reason) {
        settings = collectStateFromUi();
        await persistSettings(settings, reason);
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
        refs.backendPingStatus.textContent = text;
        refs.backendCompactStatus.textContent = text;
        [refs.backendPingStatus, refs.backendCompactStatus].forEach((node) => {
            node.classList.toggle('online', ok === true);
            node.classList.toggle('offline', ok === false);
        });
    }

    async function pingBackend() {
        setBackendStatus('Проверка...', null);
        const baseUrl = (refs.customBackendToggle.checked ? refs.backendApiBaseUrl.value : defaultMoodleUrl()).trim().replace(/\/$/, '');
        if (!baseUrl) {
            setBackendStatus('URL пустой', false);
            return false;
        }
        try {
            const response = await fetch(baseUrl + '/v2/status', {
                cache: 'no-store'
            });
            const ok = response.ok || response.status === 401 || response.status === 403;
            setBackendStatus(ok ? 'Онлайн' : 'Ошибка ' + response.status, ok);
            return ok;
        } catch (_) {
            setBackendStatus('Оффлайн', false);
            return false;
        }
    }

    async function checkUpdate() {
        const baseUrl = settings.backend.moodle.apiBaseUrl || defaultMoodleUrl();
        const url = (buildConfig.updateCheckUrl || (baseUrl + '/v2/update'))
            + '?version=' + encodeURIComponent(manifest.version || '')
            + '&build_id=' + encodeURIComponent(buildConfig.buildId || '');
        refs.updateStatus.textContent = 'Проверка...';
        refs.updateStatus.classList.remove('online', 'offline');
        try {
            const response = await fetch(url, { cache: 'no-store' });
            const data = await response.json();
            if (data.updateRequired) {
                refs.updateStatus.textContent = 'Доступна ' + (data.latestVersion || 'новая');
                refs.updateStatus.classList.add('offline');
            } else {
                refs.updateStatus.textContent = 'Актуально';
                refs.updateStatus.classList.add('online');
            }
        } catch (_) {
            refs.updateStatus.textContent = 'Ошибка';
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
                input.value = '';
                scheduleAppSave('hotkey-clear');
                return;
            }
            const value = settingsApi.serializeHotkey(event);
            if (value) {
                input.value = value;
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
        setBackendStatus('Не проверено', null);
        scheduleAppSave('backend-reset');
    });
    refs.btnSave.addEventListener('click', () => save('save-button'));
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
        refs.moodleQueueStatus.textContent = queue?.active
            ? `Тест ${queue.index + 1} из ${queue.links.length} — ${stages[queue.stage] || 'ожидаем'}: ${queue.links[queue.index]}`
            : (queue?.error || (!queue ? 'Очередь не запущена' : (queue.index === queue.links.length ? `Готово: ${queue.index} из ${queue.links.length}` : 'Очередь остановлена')));
    }

    refs.moodleQueueStart.addEventListener('click', async () => {
        const file = refs.moodleQueueFile.files?.[0];
        if (!file || !/\.txt$/i.test(file.name)) {
            refs.moodleQueueStatus.textContent = 'Выберите файл .txt';
            return;
        }
        const lines = (await file.text()).split(/\r?\n/).map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));
        let links;
        try {
            links = lines.map((line) => {
                const url = new URL(line);
                if (!/^https?:$/.test(url.protocol) || !/\/mod\/quiz\/view\.php$/.test(url.pathname)
                    || !/^\d+$/.test(url.searchParams.get('id') || '')) {
                    throw new Error('Некорректная ссылка: ' + line);
                }
                return url.href;
            });
            if (!links.length || !links.every((url) => new URL(url).origin === new URL(links[0]).origin)) {
                throw new Error('Нужны ссылки на тесты одного сайта, по одной на строку.');
            }
        } catch (error) {
            refs.moodleQueueStatus.textContent = error.message;
            return;
        }
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = 0;
        }
        await save('moodle-queue-start');
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
            refs.moodleQueueStatus.textContent = 'Не найдена активная вкладка';
            return;
        }
        try {
            const key = 'paramExtMoodleQueue';
            const previous = (await chrome.storage.local.get(key))[key];
            if (previous?.active && (previous.tabId !== tabs[0].id || previous.attemptId || previous.stage === 'submitted')) {
                refs.moodleQueueStatus.textContent = 'Очередь уже обрабатывает попытку. Остановите её перед новым запуском.';
                return;
            }
            const launchToken = crypto.randomUUID();
            const queue = { active: true, tabId: tabs[0].id, links, index: 0, attemptId: null,
                stage: 'view', origin: new URL(links[0]).origin, launchToken, error: '' };
            await chrome.storage.local.set({ [key]: queue });
            refs.moodleQueueStatus.textContent = `Запущено: 1 из ${links.length}`;
            const destination = new URL(links[0]);
            destination.hash = 'moodl0-queue=' + launchToken;
            await chrome.tabs.update(queue.tabId, { url: destination.href, active: true });
        } catch (error) {
            const key = 'paramExtMoodleQueue';
            const queue = (await chrome.storage.local.get(key))[key];
            if (queue?.active && queue.tabId === tabs[0].id && queue.links[0] === links[0]) {
                await chrome.storage.local.set({ [key]: { ...queue, active: false, error: String(error.message || error) } });
            }
            refs.moodleQueueStatus.textContent = error.message || 'Не удалось открыть тест';
        }
    });
    refs.moodleQueueStop.addEventListener('click', async () => {
        const key = 'paramExtMoodleQueue';
        const queue = (await chrome.storage.local.get(key))[key];
        if (queue?.active) {
            await chrome.storage.local.set({ [key]: { ...queue, active: false } });
        }
        await showMoodleQueueStatus();
    });
    showMoodleQueueStatus();

    [
        refs.nextBtnSelector,
        refs.moodleAutoInsertOnLoad,
        refs.moodleAutoFinishAttempt,
        refs.moodleAutoSubmitAttempt
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
