// Decides what to do with the best answer found for one question:
// insert it, only hint it (highlight mode), or hold it back when it is
// below the user's confidence threshold. Also keeps a per-attempt report
// (sessionStorage) that the summary page uses for the pre-submit check.
(function (global) {
    const t = (text, ...args) => (global.ParamExtI18n ? global.ParamExtI18n.t(text, ...args) : text.replace(/\{(\d+)\}/g, (_, i) => args[i]));

    function attemptId() {
        try {
            return new URL(location.href).searchParams.get('attempt') || '';
        } catch (_) {
            return '';
        }
    }

    function reportKey(id) {
        return 'moodl0AttemptReport:' + (id || attemptId());
    }

    function readReport(id) {
        try {
            const parsed = JSON.parse(sessionStorage.getItem(reportKey(id)) || 'null');
            if (parsed && typeof parsed === 'object' && parsed.questions && Array.isArray(parsed.seen)) {
                return parsed;
            }
        } catch (_) {
            // Broken report: start over.
        }
        return { questions: {}, seen: [] };
    }

    function writeReport(report, id) {
        try {
            sessionStorage.setItem(reportKey(id), JSON.stringify(report));
        } catch (_) {
            // Report is best-effort only.
        }
    }

    function questionNumber(container) {
        const qno = container && container.querySelector ? container.querySelector('.qno') : null;
        const text = qno ? qno.textContent.trim() : '';
        return text || (container && container.id) || '?';
    }

    function record(container, entry) {
        const report = readReport();
        const qno = questionNumber(container);
        report.questions[qno] = Object.assign({ at: Date.now() }, entry);
        if (!report.seen.includes(qno)) {
            report.seen.push(qno);
        }
        writeReport(report);
    }

    function markSeen(numbers) {
        const report = readReport();
        numbers.forEach((qno) => {
            if (qno && !report.seen.includes(qno)) {
                report.seen.push(qno);
            }
        });
        writeReport(report);
    }

    function dataKey(item) {
        try {
            return JSON.stringify(item && item.data);
        } catch (_) {
            return null;
        }
    }

    function votesFor(best, submissions) {
        if (!best) {
            return 0;
        }
        if (submissions.includes(best)) {
            return Number(best.count) || 0;
        }
        const key = dataKey(best);
        let votes = 0;
        submissions.forEach((item) => {
            if (item && item.correctness !== 0 && (item.label === best.label || (key !== null && dataKey(item) === key))) {
                votes = Math.max(votes, Number(item.count) || 0);
            }
        });
        return votes;
    }

    function isLow(confidencePct, votes, thresholds) {
        const minConfidence = Number(thresholds && thresholds.minConfidence) || 0;
        const minVotes = Number(thresholds && thresholds.minVotes) || 0;
        const checks = [];
        if (minConfidence > 0) {
            checks.push(confidencePct === null || confidencePct < minConfidence);
        }
        if (minVotes > 0) {
            checks.push(votes < minVotes);
        }
        return checks.length > 0 && checks.every(Boolean);
    }

    function describe(confidencePct, votes) {
        const parts = [];
        if (confidencePct !== null) {
            parts.push(confidencePct + '%');
        }
        parts.push(t('голосов: {0}', votes));
        return parts.join(' · ');
    }

    function addNote(container, className, text) {
        if (!container) {
            return;
        }
        container.querySelectorAll(':scope .moodl0-note').forEach((node) => node.remove());
        const note = document.createElement('div');
        note.className = 'moodl0-note ' + className;
        note.textContent = text;
        const anchor = container.querySelector('.formulation') || container.querySelector('.content') || container;
        anchor.appendChild(note);
    }

    function snapshot(container) {
        return Array.from(container.querySelectorAll('input, select, textarea')).map((el) => ({
            el,
            checked: el.checked,
            value: el.value,
            selectedIndex: el instanceof HTMLSelectElement ? el.selectedIndex : -1
        }));
    }

    function restore(states) {
        states.forEach((state) => {
            const el = state.el;
            if (el.type === 'radio' || el.type === 'checkbox') {
                el.checked = state.checked;
            } else if (el instanceof HTMLSelectElement) {
                el.selectedIndex = state.selectedIndex;
            } else if (el.type !== 'hidden') {
                el.value = state.value;
            }
        });
    }

    // Highlight mode: run the real insert, see which controls it changed,
    // put everything back and mark those controls instead.
    function highlight(container, best, apply) {
        container.querySelectorAll('.moodl0-hl').forEach((node) => node.classList.remove('moodl0-hl'));
        container.querySelectorAll('.moodl0-hint').forEach((node) => node.remove());
        const before = snapshot(container);
        let marked = 0;
        try {
            apply(best.data);
        } catch (error) {
            console.error(error);
        }
        const after = snapshot(container);
        after.forEach((state, index) => {
            const old = before[index];
            if (!old || old.el !== state.el) {
                return;
            }
            const el = state.el;
            if ((el.type === 'radio' || el.type === 'checkbox') && state.checked && !old.checked) {
                const row = el.closest('.answer > div, .answer tr, label') || el.parentElement;
                (row || el).classList.add('moodl0-hl');
                marked += 1;
            } else if (el instanceof HTMLSelectElement && state.selectedIndex !== old.selectedIndex) {
                const option = el.options[state.selectedIndex];
                el.classList.add('moodl0-hl');
                el.insertAdjacentElement('afterend', hintNode(option ? option.textContent : state.value));
                marked += 1;
            } else if (el.type !== 'hidden' && el.type !== 'radio' && el.type !== 'checkbox' && state.value !== old.value && state.value) {
                el.classList.add('moodl0-hl');
                el.insertAdjacentElement('afterend', hintNode(state.value));
                marked += 1;
            }
        });
        restore(before);
        return marked;
    }

    function hintNode(text) {
        const span = document.createElement('span');
        span.className = 'moodl0-hint';
        span.textContent = '→ ' + String(text || '').trim();
        return span;
    }

    function ensureInsertQueue() {
        if (!global.ParamExtMoodleAutoInsert) {
            global.ParamExtMoodleAutoInsert = {
                items: [],
                apply() {
                    let applied = 0;
                    this.items.forEach((item) => {
                        try {
                            if (item() !== false) {
                                applied += 1;
                            }
                        } catch (error) {
                            console.error(error);
                        }
                    });
                    return applied;
                },
                clear() {
                    this.items = [];
                }
            };
        }
        return global.ParamExtMoodleAutoInsert;
    }

    function handle(options) {
        const container = options.container;
        const best = options.best;
        const suggestions = Array.isArray(options.suggestions) ? options.suggestions : [];
        const submissions = Array.isArray(options.submissions) ? options.submissions : [];
        const settings = options.settings || {};
        const thresholds = options.thresholds || settings;
        const apply = options.apply;

        if (!best) {
            record(container, { status: 'none' });
            return;
        }

        const votes = votesFor(best, submissions);
        const confidencePct = suggestions.includes(best) ? Math.round((Number(best.confidence) || 0) * 100) : null;
        const low = isLow(confidencePct, votes, thresholds);
        const info = { label: best.label, confidence: confidencePct, votes };

        ensureInsertQueue().items.push(() => {
            if (low) {
                return false;
            }
            apply(best.data);
            return true;
        });

        if (settings.mode === 'highlight') {
            highlight(container, best, apply);
            addNote(container, low ? 'moodl0-note-low' : 'moodl0-note-hint',
                low ? t('MooDL0: не уверен — {0} ({1})', best.label, describe(confidencePct, votes))
                    : t('MooDL0: подсказка — {0} ({1})', best.label, describe(confidencePct, votes)));
            record(container, Object.assign({ status: low ? 'low' : 'hint' }, info));
            return;
        }

        const autoMode = (settings.mode === 'autoInsert' && settings.autoInsertOnLoad !== false)
            || (settings.mode === 'autoSolve' && settings.autoSolving);

        if (low) {
            if (autoMode) {
                container && container.classList.add('moodl0-low');
                addNote(container, 'moodl0-note-low',
                    t('MooDL0: ответ не вставлен — {0} ({1}). Проверьте вручную.', best.label, describe(confidencePct, votes)));
            }
            record(container, Object.assign({ status: 'low' }, info));
            return;
        }

        if (autoMode) {
            apply(best.data);
            record(container, Object.assign({ status: 'applied' }, info));
        } else {
            record(container, Object.assign({ status: 'found' }, info));
        }
    }

    global.ParamExtAnswerAssist = {
        handle,
        readReport,
        writeReport,
        markSeen,
        questionNumber,
        isLow,
        votesFor
    };
})(globalThis);
