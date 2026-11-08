(async function () {
    const path = location.pathname;
    const isView = /\/mod\/quiz\/view\.php$/.test(path);
    const isSummary = /\/mod\/quiz\/summary\.php$/.test(path);
    const isReview = /\/mod\/quiz\/review\.php$/.test(path);
    if (!isView && !isSummary && !isReview) {
        return;
    }

    const stored = (await chrome.storage.local.get('paramExtMoodleQueue')).paramExtMoodleQueue;
    const tabs = isView ? null : await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_CONTEXT' }).catch(() => null);
    const currentUrl = new URL(location.href);
    const queue = isView && stored?.active && stored.stage === 'view'
        && stored.origin === currentUrl.origin
        && currentUrl.hash === '#moodl0-queue=' + stored.launchToken
        && stored.links?.[stored.index] === currentUrl.origin + currentUrl.pathname + currentUrl.search
        ? { active: true, url: stored.links[stored.index], stage: stored.stage, tabId: stored.tabId }
        : tabs;
    const active = Boolean(queue?.active);
    const attemptId = new URL(location.href).searchParams.get('attempt');
    if (isReview) {
        if (active) {
            await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_REVIEW', result: readReviewResult() });
        }
        return;
    }

    function readReviewResult() {
        const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        let grade = '';
        let marks = '';
        document.querySelectorAll('table.quizreviewsummary tr').forEach((row) => {
            const head = clean(row.querySelector('th')?.textContent).toLowerCase();
            const value = clean(row.querySelector('td')?.textContent);
            if (!value) {
                return;
            }
            if (/оценка|grade/.test(head)) {
                grade = value;
            } else if (/балл|marks/.test(head)) {
                marks = value;
            }
        });
        const crumbs = Array.from(document.querySelectorAll('.breadcrumb-item'));
        const name = clean(document.querySelector('.page-header-headings h1')?.textContent)
            || clean(crumbs[crumbs.length - 1]?.textContent)
            || clean(document.title);
        return { grade: grade || marks, name };
    }

    if (isView) {
        if (!active) {
            return;
        }
        const expected = new URL(queue.url);
        const current = new URL(location.href);
        if (current.pathname !== expected.pathname || current.searchParams.get('id') !== expected.searchParams.get('id')) {
            return;
        }
        if (document.querySelector('#mod_quiz_preflight_form, .quizsecuremoderequired')) {
            await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_ERROR', error: 'Тест требует подтверждения или ввода перед запуском.' });
            return;
        }
        const button = document.querySelector('.quizstartbuttondiv [type="submit"]');
        const form = button?.closest('form');
        if (!button || button.disabled || !form || form.method.toLowerCase() !== 'post'
            || new URL(form.action).origin !== location.origin
            || !/\/mod\/quiz\/startattempt\.php$/.test(new URL(form.action).pathname)
            || !form.querySelector('[name="sesskey"]')
            || form.querySelector('[name="cmid"]')?.value !== expected.searchParams.get('id')) {
            await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_ERROR', error: 'Не найдена стандартная форма запуска попытки Moodle.' });
            return;
        }
        const key = 'paramExtMoodleQueue';
        const latest = (await chrome.storage.local.get(key))[key];
        if (!latest?.active || latest.stage !== 'view' || latest.tabId !== queue.tabId
            || latest.index !== stored.index || latest.links[latest.index] !== current.origin + current.pathname + current.search
            || current.hash !== '#moodl0-queue=' + latest.launchToken) {
            return;
        }
        await chrome.storage.local.set({ [key]: { ...latest, stage: 'starting' } });
        HTMLFormElement.prototype.submit.call(form);
        return;
    }

    if (!attemptId || !/^\d+$/.test(attemptId)) {
        return;
    }
    const settings = await window.ParamExtSettings.getSettings();
    window.ParamExtI18n?.setLanguage(settings.ui?.language);
    const markerKey = 'paramExtMoodleFinishAttempt';
    let marker = null;
    try {
        marker = JSON.parse(sessionStorage.getItem(markerKey));
    } catch (_) {
        // Invalid marker cannot authorize submission.
    }
    sessionStorage.removeItem(markerKey);
    const fromAutoSolve = marker?.attemptId === attemptId && Date.now() - marker.at < 120000;
    const shouldSubmit = active
        ? queue.stage === 'attempt' && queue.attemptId === attemptId && fromAutoSolve
        : settings.moodle.mode === 'autoSolve' && settings.moodle.autoSolving
            && settings.moodle.autoFinishAttempt && settings.moodle.autoSubmitAttempt && fromAutoSolve;
    if (!shouldSubmit) {
        return;
    }
    const unansweredRows = document.querySelectorAll('.quizsummaryofattempt tr.notyetanswered, .quizsummaryofattempt tr.invalidanswer, .quizsummaryofattempt tr.notanswered');
    if (active && unansweredRows.length) {
        await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_ERROR', error: 'В тесте остались вопросы без ответа. Очередь остановлена.' });
        return;
    }
    if (!active) {
        if (settings.moodle.confirmBeforeSubmit === false) {
            if (unansweredRows.length) {
                return;
            }
        } else if (!(await confirmSubmit(unansweredRows))) {
            return;
        }
    }
    const form = document.querySelector('form#frm-finishattempt');
    const button = form?.querySelector('.btn-finishattempt button, button[type="submit"], input[type="submit"]');
    const formAttempt = form?.querySelector('[name="attempt"]')?.value;
    const finish = form?.querySelector('[name="finishattempt"]')?.value;
    if (!button || button.disabled || formAttempt !== attemptId || finish !== '1' || !form.querySelector('[name="sesskey"]')) {
        if (active) {
            await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_ERROR', error: 'Не удалось найти форму отправки Moodle.' });
        }
        return;
    }
    // Submit Moodle's own form with sesskey; queue advances only after review of this attempt.
    if (active && !(await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_SUBMIT' }))?.ok) {
        return;
    }
    HTMLFormElement.prototype.submit.call(form);

    // Pre-submit check for the non-queue auto mode: show what was answered
    // and by what. Submits by itself after a countdown only when nothing is
    // missing or doubtful; otherwise waits for the user.
    function confirmSubmit(unanswered) {
        const tr = (text, ...args) => (window.ParamExtI18n ? window.ParamExtI18n.t(text, ...args) : text.replace(/\{(\d+)\}/g, (_, i) => args[i]));
        const assist = window.ParamExtAnswerAssist;
        const report = assist ? assist.readReport(attemptId) : { questions: {}, seen: [] };
        const numberOf = (row) => String(row.querySelector('td, th')?.textContent || '').trim();
        const unansweredNumbers = Array.from(unanswered).map(numberOf).filter(Boolean);
        const total = document.querySelectorAll('.quizsummaryofattempt tbody tr').length || report.seen.length;
        const low = [];
        const missing = [];
        report.seen.forEach((qno) => {
            const entry = report.questions[qno];
            if (!entry || entry.status === 'none') {
                missing.push(qno);
            } else if (entry.status === 'low') {
                low.push(qno);
            }
        });
        const answeredByExtension = Object.values(report.questions).filter((entry) => entry.status === 'applied').length;
        const clean = !unansweredNumbers.length && !low.length && !missing.length;

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'moodl0-overlay';
            const dialog = document.createElement('div');
            dialog.className = 'moodl0-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            const title = document.createElement('h2');
            title.textContent = tr('Проверка перед отправкой');
            dialog.appendChild(title);
            const line = (text, className) => {
                const p = document.createElement('p');
                p.textContent = text;
                if (className) {
                    p.className = className;
                }
                dialog.appendChild(p);
            };
            line(tr('Ответы вставлены расширением: {0} из {1}', answeredByExtension, total || '?'), clean ? 'moodl0-ok' : '');
            if (unansweredNumbers.length) {
                line(tr('Без ответа в Moodle: вопросы {0}', unansweredNumbers.join(', ')), 'moodl0-bad');
            }
            if (missing.length) {
                line(tr('Нет данных: вопросы {0}', missing.join(', ')), 'moodl0-bad');
            }
            if (low.length) {
                line(tr('Низкая уверенность (не вставлены): вопросы {0}', low.join(', ')), 'moodl0-warn');
            }
            const countdown = document.createElement('p');
            dialog.appendChild(countdown);
            const actions = document.createElement('div');
            actions.className = 'moodl0-actions';
            const stopBtn = document.createElement('button');
            stopBtn.type = 'button';
            stopBtn.textContent = tr('Остановиться');
            const sendBtn = document.createElement('button');
            sendBtn.type = 'button';
            sendBtn.className = 'moodl0-primary';
            sendBtn.textContent = clean ? tr('Отправить') : tr('Отправить всё равно');
            actions.append(stopBtn, sendBtn);
            dialog.appendChild(actions);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            let timer = 0;
            const finish = (result) => {
                clearInterval(timer);
                overlay.remove();
                resolve(result);
            };
            stopBtn.addEventListener('click', () => finish(false));
            sendBtn.addEventListener('click', () => finish(true));
            if (clean) {
                let left = 10;
                const render = () => {
                    countdown.textContent = tr('Автоотправка через {0} с', left);
                };
                render();
                timer = setInterval(() => {
                    left -= 1;
                    if (left <= 0) {
                        finish(true);
                        return;
                    }
                    render();
                }, 1000);
            } else {
                countdown.textContent = tr('Есть проблемы — отправка ждёт вашего решения.');
            }
            sendBtn.focus();
        });
    }
})();
