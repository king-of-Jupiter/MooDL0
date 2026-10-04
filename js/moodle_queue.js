(function () {
    const KEY = 'paramExtMoodleQueue';
    let serial = Promise.resolve();

    function enqueue(action, sendResponse) {
        serial = serial.then(action, action).then(sendResponse, (error) => {
            sendResponse({ ok: false, error: String(error.message || error) });
        });
    }

    async function load() {
        const result = await chrome.storage.local.get(KEY);
        return result[KEY] || null;
    }

    async function save(queue) {
        await chrome.storage.local.set({ [KEY]: queue });
    }

    function origin(url) {
        try {
            const parsed = new URL(url);
            return /^https?:$/.test(parsed.protocol) ? parsed.origin : null;
        } catch (_) {
            return null;
        }
    }

    function isView(url) {
        try {
            const parsed = new URL(url);
            return /\/mod\/quiz\/view\.php$/.test(parsed.pathname) && /^\d+$/.test(parsed.searchParams.get('id') || '');
        } catch (_) {
            return false;
        }
    }

    async function handle(message, sender) {
        const queue = await load();
        if (!queue?.active || sender.tab?.id !== queue.tabId || origin(sender.url) !== queue.origin) {
            return { active: false };
        }
        const path = new URL(sender.url).pathname;
        if (message.type === 'MOODLE_QUEUE_CONTEXT') {
            const currentUrl = new URL(sender.url);
            const expected = new URL(queue.links[queue.index]);
            const matchesView = /\/mod\/quiz\/view\.php$/.test(path) && currentUrl.searchParams.get('id') === expected.searchParams.get('id');
            const matchesAttempt = /\/mod\/quiz\/(?:attempt|summary|review)\.php$/.test(path)
                && (path.endsWith('/attempt.php') ? currentUrl.searchParams.get('cmid') === expected.searchParams.get('id') : Boolean(queue.attemptId))
                && (!queue.attemptId || currentUrl.searchParams.get('attempt') === queue.attemptId);
            if (queue.stage === 'view' ? !matchesView : !matchesAttempt && !(queue.stage === 'starting' && matchesView)) {
                return { active: false };
            }
        }
        if (message.type === 'MOODLE_QUEUE_CONTEXT') {
            return { active: true, index: queue.index, total: queue.links.length,
                url: queue.links[queue.index], attemptId: queue.attemptId, stage: queue.stage };
        }
        if (message.type === 'MOODLE_QUEUE_ATTEMPT' && ['starting', 'attempt'].includes(queue.stage)
            && /\/mod\/quiz\/attempt\.php$/.test(path)
            && new URL(sender.url).searchParams.get('cmid') === new URL(queue.links[queue.index]).searchParams.get('id')) {
            if (!/^\d+$/.test(String(message.attemptId || ''))
                || new URL(sender.url).searchParams.get('attempt') !== String(message.attemptId)) {
                return { ok: false };
            }
            if (queue.attemptId && queue.attemptId !== message.attemptId) {
                return { ok: false };
            }
            await save({ ...queue, attemptId: message.attemptId, stage: 'attempt' });
            return { ok: true };
        }
        if (message.type === 'MOODLE_QUEUE_SUBMIT' && queue.stage === 'attempt'
            && /\/mod\/quiz\/summary\.php$/.test(path)
            && new URL(sender.url).searchParams.get('attempt') === queue.attemptId) {
            await save({ ...queue, stage: 'submitted' });
            return { ok: true };
        }
        if (message.type === 'MOODLE_QUEUE_ERROR') {
            await save({ ...queue, active: false, error: String(message.error || 'Нужен ручной ввод.') });
            return { ok: true };
        }
        if (message.type === 'MOODLE_QUEUE_REVIEW' && queue.stage === 'submitted'
            && /\/mod\/quiz\/review\.php$/.test(path)
            && queue.attemptId && new URL(sender.url).searchParams.get('attempt') === queue.attemptId) {
            const index = queue.index + 1;
            const next = { ...queue, index, attemptId: null, stage: 'view',
                launchToken: index < queue.links.length ? crypto.randomUUID() : null,
                active: index < queue.links.length };
            await save(next);
            if (next.active) {
                try {
                    const destination = new URL(queue.links[index]);
                    destination.hash = 'moodl0-queue=' + next.launchToken;
                    await chrome.tabs.update(queue.tabId, { url: destination.href });
                } catch (error) {
                    await save({ ...next, active: false, error: String(error.message || error) });
                    throw error;
                }
            }
            return { ok: true };
        }
        return { ok: false };
    }

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status !== 'complete' || !tab.url) {
            return;
        }
        enqueue(async () => {
            const queue = await load();
            if (!queue?.active || queue.stage !== 'view' || queue.tabId !== tabId
                || !queue.launchToken || !isView(tab.url)) {
                return;
            }
            const url = new URL(tab.url);
            if (url.origin !== queue.origin || url.hash !== '#moodl0-queue=' + queue.launchToken
                || url.origin + url.pathname + url.search !== queue.links[queue.index]) {
                return;
            }
            try {
                await chrome.scripting.executeScript({ target: { tabId }, files: ['js/moodle_flow.js'] });
            } catch (error) {
                const current = await load();
                if (current?.active && current.tabId === tabId && current.launchToken === queue.launchToken) {
                    await save({ ...current, active: false, error: 'Не удалось запустить скрипт на странице теста: ' + (error.message || error) });
                }
            }
        }, () => {});
    });

    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== 'moodle-queue') {
            return;
        }
        port.onMessage.addListener((message) => {
            if (!message?.type?.startsWith('MOODLE_QUEUE_')) {
                return;
            }
            enqueue(() => handle(message, port.sender), (response) => {
                try {
                    port.postMessage(response);
                } catch (_) {
                    // Page navigated before reply; saved queue state remains authoritative.
                }
            });
        });
    });

})();
