(async function () {
    if (window.ParamExtTelemetry) {
        window.ParamExtTelemetry.installGlobalHandlers('moodle-content');
    }

    let settings = {
        mode: 'wand',
        wandHotkey: 'Escape',
        insertHotkey: 'Alt+KeyA',
        autoInsertOnLoad: true,
        nextButtonText: 'Следующая страница',
        autoSolving: false,
        autoFinishAttempt: false
    };
    let queueActive = false;

    async function loadSettings() {
        if (window.ParamExtSettings) {
            const all = await window.ParamExtSettings.getSettings();
            settings = { ...all.moodle };
            if (window.ParamExtI18n) {
                window.ParamExtI18n.setLanguage(all.ui && all.ui.language);
            }
        }
        try {
            const queue = await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_CONTEXT' });
            const attemptId = new URL(location.href).searchParams.get('attempt');
            if (queue?.active && /\/mod\/quiz\/attempt\.php$/.test(location.pathname)
                && (queue.stage === 'starting' || (queue.stage === 'attempt' && queue.attemptId === attemptId))) {
                const registered = await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_ATTEMPT', attemptId });
                if (registered?.ok) {
                    queueActive = true;
                    settings.mode = 'autoSolve';
                    settings.autoSolving = true;
                    settings.autoFinishAttempt = true;
                }
            }
        } catch (error) {
            console.error('Moodle queue unavailable', error);
        }
    }

    function getAllShadowRoots(node) {
        const rootNode = node || document.body;
        const shadowRoots = [];
        const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode()) {
            const element = walker.currentNode;
            if (element.shadowRoot) {
                shadowRoots.push(element.shadowRoot);
                const nested = getAllShadowRoots(element.shadowRoot);
                nested.forEach((item) => shadowRoots.push(item));
            }
        }
        return shadowRoots;
    }

    function getMagicButtons() {
        const buttons = [];
        const roots = getAllShadowRoots();
        roots.forEach((root) => {
            const button = root.querySelector('.icon.magic');
            if (button) {
                buttons.push(button);
            }
        });
        return buttons;
    }

    function setWandsVisible(visible) {
        getMagicButtons().forEach((button) => {
            button.style.display = visible ? '' : 'none';
        });
    }

    function toggleWands() {
        const buttons = getMagicButtons();
        const hasHidden = buttons.some((button) => button.style.display === 'none');
        setWandsVisible(hasHidden);
    }

    function clickNextButton() {
        const next = document.querySelector('#mod_quiz-next-nav') || Array.from(document.querySelectorAll('button, input[type="submit"]')).find((element) => {
            if (!(element instanceof HTMLElement) || !element.closest('form#responseform')) {
                return false;
            }
            const label = element instanceof HTMLInputElement ? element.value : element.textContent;
            return (label || '').trim() === settings.nextButtonText;
        });
        if (!next || next.disabled) {
            return;
        }

        const form = next.closest('form');
        const isLastPage = form?.querySelector('input[name="nextpage"]')?.value === '-1';
        if (isLastPage && !settings.autoFinishAttempt) {
            return;
        }
        if (isLastPage) {
            const attemptId = form?.querySelector('input[name="attempt"]')?.value;
            if (attemptId) {
                sessionStorage.setItem('paramExtMoodleFinishAttempt', JSON.stringify({ attemptId, at: Date.now() }));
            }
        }
        next.click();
    }

    function applyQueuedAnswers() {
        const api = window.ParamExtMoodleAutoInsert;
        if (!api || typeof api.apply !== 'function') {
            return 0;
        }

        try {
            return Number(api.apply()) || 0;
        } catch (error) {
            console.error(error);
            return 0;
        }
    }

    function hasAnsweredDataOnPage() {
        const checkedOptions = document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
        if (checkedOptions.length > 0) {
            return true;
        }

        const hasFilledTextInput = Array.from(document.querySelectorAll('textarea, input[type="text"], input[type="number"]')).some((element) => {
            if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
                return false;
            }
            return element.value.trim().length > 0;
        });
        if (hasFilledTextInput) {
            return true;
        }

        const hasMeaningfulSelect = Array.from(document.querySelectorAll('select')).some((element) => {
            if (!(element instanceof HTMLSelectElement)) {
                return false;
            }
            return element.selectedIndex > 0 || (element.value && element.value.trim().length > 0);
        });

        return hasMeaningfulSelect;
    }

    function applySettings() {
        if (settings.mode === 'wand') {
            setWandsVisible(true);
        }

        if (settings.mode === 'autoSolve' && settings.autoSolving) {
            if (advanceScheduled) {
                return;
            }
            advanceScheduled = true;
            let started = 0;
            const advance = async () => {
                hidePill();
                if (!settings.autoSolving) {
                    advanceScheduled = false;
                    return;
                }
                if (!started) {
                    started = Date.now();
                }
                if (queueActive) {
                    const queue = await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_CONTEXT' }).catch(() => null);
                    if (!queue?.active || queue.stage !== 'attempt') {
                        return;
                    }
                    applyQueuedAnswers();
                }
                if (hasAnsweredDataOnPage()) {
                    clickNextButton();
                } else if (queueActive && Date.now() - started < 15000) {
                    setTimeout(advance, 1000);
                } else if (queueActive) {
                    window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_ERROR', error: 'Ответ для текущей страницы не найден. Очередь остановлена.' });
                }
            };
            const min = Math.max(0, Number(settings.pageDelayMin) || 0);
            const max = Math.max(min, Number(settings.pageDelayMax) || 0);
            const extraMs = Math.round((min + Math.random() * (max - min)) * 1000);
            const waitMs = 3500 + extraMs;
            if (extraMs > 0) {
                showCountdown(waitMs);
            }
            setTimeout(advance, waitMs);
        }
    }

    let advanceScheduled = false;
    let pill = null;
    let pillTimer = 0;

    function tr(text, ...args) {
        return window.ParamExtI18n ? window.ParamExtI18n.t(text, ...args) : text.replace(/\{(\d+)\}/g, (_, i) => args[i]);
    }

    function hidePill() {
        clearInterval(pillTimer);
        pillTimer = 0;
        if (pill) {
            pill.remove();
            pill = null;
        }
    }

    function showCountdown(totalMs) {
        hidePill();
        const until = Date.now() + totalMs;
        pill = document.createElement('div');
        pill.className = 'moodl0-pill';
        pill.setAttribute('role', 'status');
        const render = () => {
            const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
            if (pill) {
                pill.textContent = tr('MooDL0: следующая страница через {0} с', left);
            }
        };
        render();
        document.body.appendChild(pill);
        pillTimer = setInterval(render, 500);
    }

    function recordQuestionsOnPage() {
        const assist = window.ParamExtAnswerAssist;
        if (!assist || !/\/mod\/quiz\/attempt\.php$/.test(location.pathname)) {
            return;
        }
        const numbers = Array.from(document.querySelectorAll('.que')).map((node) => assist.questionNumber(node));
        assist.markSeen(numbers);
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (!message || typeof message !== 'object') {
            return;
        }

        if (message.type === 'SETTINGS_UPDATED') {
            if (message.settings && message.settings.moodle) {
                settings = Object.assign({}, settings, message.settings.moodle, {
                    autoSolving: Boolean(message.settings.moodle.autoSolving),
                    autoFinishAttempt: Boolean(message.settings.moodle.autoFinishAttempt)
                });
                if (window.ParamExtI18n && message.settings.ui) {
                    window.ParamExtI18n.setLanguage(message.settings.ui.language);
                }
            } else if (message.settings) {
                settings = {
                    mode: message.settings.mode || settings.mode,
                    wandHotkey: message.settings.wandKey || settings.wandHotkey,
                    insertHotkey: message.settings.insertKey || settings.insertHotkey,
                    autoInsertOnLoad: message.settings.autoInsertOnLoad !== false,
                    nextButtonText: message.settings.nextBtnText || settings.nextButtonText,
                    autoSolving: Boolean(message.settings.autoSolving),
                    autoFinishAttempt: Boolean(message.settings.autoFinishAttempt)
                };
            }
            applySettings();
        }

        if (message.type === 'START_AUTO_SOLVE') {
            settings.autoSolving = true;
            if (settings.mode === 'autoSolve') {
                window.location.reload();
            }
        }

        if (message.type === 'STOP_AUTO_SOLVE') {
            settings.autoSolving = false;
        }
    });

    document.addEventListener('keydown', (event) => {
        if (window.ParamExtSettings) {
            if (window.ParamExtSettings.hotkeyMatches(event, settings.insertHotkey)) {
                event.preventDefault();
                applyQueuedAnswers();
                return;
            }
            if (window.ParamExtSettings.hotkeyMatches(event, settings.wandHotkey)) {
                toggleWands();
            }
            return;
        }

        if (event.code === settings.insertHotkey || event.key === settings.insertHotkey) {
            event.preventDefault();
            applyQueuedAnswers();
            return;
        }

        if (event.code === settings.wandHotkey || event.key === settings.wandHotkey) {
            toggleWands();
        }
    });

    await loadSettings();
    recordQuestionsOnPage();

    if (window.ParamExtTelemetry) {
        window.ParamExtTelemetry.push('system_state', {
            mode: settings.mode,
            autoSolving: settings.autoSolving,
            autoInsertOnLoad: settings.autoInsertOnLoad,
            host: location.host
        }, 'moodle-content');
    }

    applySettings();
})();
