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
            await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_REVIEW' });
        }
        return;
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
    if (document.querySelector('.quizsummaryofattempt tr.notyetanswered, .quizsummaryofattempt tr.invalidanswer, .quizsummaryofattempt tr.notanswered')) {
        if (active) {
            await window.ParamExtMoodleQueue.request({ type: 'MOODLE_QUEUE_ERROR', error: 'В тесте остались вопросы без ответа. Очередь остановлена.' });
        }
        return;
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
})();
