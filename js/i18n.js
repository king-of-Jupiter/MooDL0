// Tiny RU -> EN translation layer shared by the popup, content scripts and
// the background. Russian source strings are the keys, so untranslated text
// simply stays Russian. "{0}"-style placeholders are filled by t().
(function (global) {
    const EN = {
        // Popup: privacy screen
        'Первый запуск': 'First run',
        'Нужно принять политику данных': 'Please accept the data policy',
        'Согласие открывается на отдельной странице расширения. После принятия вернитесь сюда — настройки откроются автоматически.': 'The policy opens on a separate extension page. Come back here after accepting it and the settings will open.',
        'Открыть политику': 'Open policy',
        'Я уже принял': 'I have accepted it',

        // Tabs, header
        'Решение': 'Solve',
        'Очередь': 'Queue',
        'Настройки': 'Settings',
        'Разделы': 'Sections',
        'Нужно согласие': 'Consent required',
        'Сервер онлайн': 'Server online',
        'Сервер недоступен': 'Server unavailable',
        'Проверяем сервер…': 'Checking server…',
        'Telegram-канал MooDL0': 'MooDL0 Telegram channel',

        // Modes
        'Режим Moodle': 'Moodle mode',
        'Палочка': 'Wand',
        'Авто-вставка': 'Auto-insert',
        'Подсказка': 'Hint',
        'Авто-прохождение': 'Auto-solve',
        'Рядом с вопросом появляется палочка: нажмите её, чтобы увидеть рекомендации и статистику ответов и вставить нужный вручную.': 'A wand appears next to each question: click it to see suggestions and answer statistics and insert one yourself.',
        'Лучший ответ (по уверенности и статистике) вставляется сам, но страницы вы листаете и отправляете вручную.': 'The best answer (by confidence and statistics) is inserted for you; you turn pages and submit yourself.',
        'Ничего не вставляется: лучший ответ подсвечивается зелёным прямо в вопросе, выбираете вы сами.': 'Nothing is inserted: the best answer is highlighted in green inside the question and you choose.',
        'Расширение само вставляет ответы и переходит по страницам. Нажмите «Старт» на странице теста.': 'The extension inserts answers and turns pages by itself. Press “Start” on the quiz page.',
        'Остановлено': 'Stopped',
        'Работает': 'Running',
        '▶ Старт': '▶ Start',
        '■ Стоп': '■ Stop',

        // Options
        'Вставлять ответы сразу после загрузки': 'Insert answers right after the page loads',
        'Иначе — по горячей клавише вставки': 'Otherwise use the insert hotkey',
        'Переходить к итогам после последней страницы': 'Go to the summary after the last page',
        'Автоматически отправлять попытку': 'Submit the attempt automatically',
        'Попытка будет отправлена в Moodle': 'The attempt will be submitted to Moodle',
        'Проверка перед отправкой': 'Check before submitting',
        'Сводка по ответам; без проблем — отправка через 10 с': 'Shows an answer summary; submits after 10 s if all is fine',
        'Порог уверенности': 'Confidence threshold',
        '0 — без ограничений': '0 means no limit',
        'Мин. уверенность, %': 'Min. confidence, %',
        'Мин. голосов': 'Min. votes',
        'Если ответ не проходит оба порога, он не вставляется, а вопрос подсвечивается для ручной проверки.': 'If an answer fails both thresholds it is not inserted and the question is marked for manual review.',
        'Пауза между страницами, с': 'Pause between pages, s',
        'от': 'from',
        'до': 'to',
        'Вставка': 'Insert',
        'Изменить': 'Change',

        // Queue
        'Очередь не запущена': 'Queue not started',
        '↻ Продолжить': '↻ Resume',
        '↻ Продолжить с теста {0}': '↻ Resume from quiz {0}',
        'Ссылки на тесты — по одной на строку': 'Quiz links, one per line',
        'Добавить': 'Add',
        '+ Текущая вкладка': '+ Current tab',
        '+ Тесты со страницы': '+ Quizzes on page',
        'Все ссылки на тесты с открытой страницы курса': 'All quiz links from the open course page',
        'Список': 'List',
        'Импорт .txt': 'Import .txt',
        'Очистить': 'Clear',
        'Точно очистить?': 'Really clear?',
        '▶ Запустить очередь': '▶ Start queue',
        '■ Остановить очередь': '■ Stop queue',
        'Ссылки — на тесты одного сайта. Очередь сама завершает и отправляет попытки и останавливается, если ответа нет или нужен ручной ввод.': 'Links must point to quizzes on one site. The queue finishes and submits attempts itself and stops when an answer is missing or manual input is needed.',
        'История': 'History',
        'Очистить историю': 'Clear history',
        'Пока пусто — здесь появятся пройденные тесты': 'Nothing yet: finished quizzes will appear here',
        'ошибка': 'error',
        'Тест {0} из {1} — {2}': 'Quiz {0} of {1}: {2}',
        'Тест {0} из {1}: {2}': 'Quiz {0} of {1}: {2}',
        'Готово: пройдено {0} из {1}': 'Done: {0} of {1} completed',
        'Очередь остановлена': 'Queue stopped',
        'открываем тест': 'opening quiz',
        'запускаем попытку': 'starting attempt',
        'решаем вопросы': 'answering questions',
        'ожидаем результат': 'waiting for result',
        'ожидаем': 'waiting',
        'Некорректная ссылка: ': 'Invalid link: ',
        'Нужны ссылки на тесты одного сайта.': 'All links must be quizzes on the same site.',
        'Пока пусто — вставьте ссылки или добавьте текущую вкладку': 'Empty: paste links or add the current tab',
        'тест #': 'quiz #',
        'Убрать из списка': 'Remove from list',
        'Убрать ссылку ': 'Remove link ',
        'Вставьте ссылки в поле выше.': 'Paste links into the field above.',
        'Добавлено: {0} из {1}': 'Added: {0} of {1}',
        ' (дубли пропущены: {0})': ' (duplicates skipped: {0})',
        '. Всего в списке: {0}.': '. Total in list: {0}.',
        'Все эти ссылки уже есть в списке.': 'All of these links are already in the list.',
        'Не удалось прочитать адрес текущей вкладки.': 'Could not read the current tab address.',
        'Текущая вкладка добавлена. Всего в списке: {0}.': 'Current tab added. Total in list: {0}.',
        'Эта вкладка уже есть в списке.': 'This tab is already in the list.',
        'Текущая вкладка — не страница теста Moodle (нужна ссылка вида …/mod/quiz/view.php?id=...).': 'The current tab is not a Moodle quiz page (expected …/mod/quiz/view.php?id=...).',
        'Нужен файл .txt.': 'A .txt file is required.',
        'В файле нет ссылок.': 'The file has no links.',
        'Импортировано: {0} из {1}': 'Imported: {0} of {1}',
        'Все ссылки из файла уже есть в списке.': 'All links from the file are already in the list.',
        'Список пуст — добавьте ссылки выше или импортируйте .txt.': 'The list is empty: add links above or import a .txt file.',
        'Не найдена активная вкладка': 'No active tab found',
        'Очередь уже обрабатывает попытку. Остановите её перед новым запуском.': 'The queue is already working on an attempt. Stop it before starting again.',
        'Запущено: {0} из {1}': 'Started: {0} of {1}',
        'Не удалось открыть тест': 'Could not open the quiz',
        'Откройте страницу курса Moodle в текущей вкладке.': 'Open a Moodle course page in the current tab.',
        'Не удалось прочитать страницу.': 'Could not read the page.',
        'На этой странице нет ссылок на тесты.': 'There are no quiz links on this page.',
        'Найдено тестов: {0}, добавлено: {1}. Всего в списке: {2}.': 'Quizzes found: {0}, added: {1}. Total in list: {2}.',
        'Все {0} тестов со страницы уже в списке.': 'All {0} quizzes from this page are already in the list.',

        // Settings tab
        'Горячие клавиши': 'Hotkeys',
        'Показать / скрыть палочки': 'Show / hide wands',
        'Вставить ответы': 'Insert answers',
        'Нажмите клавишу…': 'Press a key…',
        'Кликните в поле и нажмите сочетание. Backspace — очистить.': 'Click the field and press a combination. Backspace clears it.',
        'Текст кнопки «Далее» в Moodle': 'Text of the Moodle “Next” button',
        'Общие': 'General',
        'Язык': 'Language',
        'Как в браузере': 'Same as browser',
        'Русский': 'Русский',
        'Уведомления об очереди': 'Queue notifications',
        'Когда очередь завершена или остановилась': 'When the queue finishes or stops',
        'Экспорт настроек': 'Export settings',
        'Импорт': 'Import',
        'Файл содержит настройки и список ссылок очереди.': 'The file contains your settings and the queue link list.',
        'Файл настроек сохранён.': 'Settings file saved.',
        'Импортировано: настройки и {0} ссылок.': 'Imported: settings and {0} links.',
        'Это не файл настроек MooDL0.': 'This is not a MooDL0 settings file.',
        'Подключение': 'Connection',
        'Проверить обновления': 'Check for updates',
        'Сервер': 'Server',
        'Не проверено': 'Not checked',
        'Обновления': 'Updates',
        'Сборка': 'Build',
        'Свой сервер (backend)': 'Custom server (backend)',
        'Сбросить URL': 'Reset URL',
        'Изменения сохраняются автоматически': 'Changes are saved automatically',
        'Сохранено ✓': 'Saved ✓',
        'Проверка...': 'Checking...',
        'URL пустой': 'URL is empty',
        'Онлайн': 'Online',
        'Оффлайн': 'Offline',
        'Ошибка ': 'Error ',
        'Ошибка': 'Error',
        'Доступна ': 'Available: ',
        'новая': 'new',
        'Актуально': 'Up to date',

        // Quiz page
        'MooDL0: следующая страница через {0} с': 'MooDL0: next page in {0} s',
        'голосов: {0}': 'votes: {0}',
        'MooDL0: не уверен — {0} ({1})': 'MooDL0: not sure: {0} ({1})',
        'MooDL0: подсказка — {0} ({1})': 'MooDL0: hint: {0} ({1})',
        'MooDL0: ответ не вставлен — {0} ({1}). Проверьте вручную.': 'MooDL0: answer not inserted: {0} ({1}). Please check manually.',
        'Ответы вставлены расширением: {0} из {1}': 'Answers inserted by the extension: {0} of {1}',
        'Без ответа в Moodle: вопросы {0}': 'Unanswered in Moodle: questions {0}',
        'Нет данных: вопросы {0}': 'No data: questions {0}',
        'Низкая уверенность (не вставлены): вопросы {0}': 'Low confidence (not inserted): questions {0}',
        'Остановиться': 'Stop',
        'Отправить': 'Submit',
        'Отправить всё равно': 'Submit anyway',
        'Автоотправка через {0} с': 'Auto-submit in {0} s',
        'Есть проблемы — отправка ждёт вашего решения.': 'There are problems: submission waits for your decision.',

        // Queue errors and notifications
        'Ответ для текущей страницы не найден. Очередь остановлена.': 'No answer found for the current page. Queue stopped.',
        'Тест требует подтверждения или ввода перед запуском.': 'The quiz needs confirmation or input before starting.',
        'Не найдена стандартная форма запуска попытки Moodle.': 'Standard Moodle start-attempt form not found.',
        'В тесте остались вопросы без ответа. Очередь остановлена.': 'Some questions are unanswered. Queue stopped.',
        'Не удалось найти форму отправки Moodle.': 'Moodle submit form not found.',
        'Не удалось запустить скрипт на странице теста: ': 'Could not run the script on the quiz page: ',
        'Нужен ручной ввод.': 'Manual input required.',
        'MooDL0: очередь остановлена': 'MooDL0: queue stopped',
        'MooDL0: очередь завершена': 'MooDL0: queue finished',
        'Пройдено тестов: {0}': 'Quizzes completed: {0}'
    };

    const DICTS = { en: EN };
    let current = 'ru';

    function detect() {
        let ui = '';
        try {
            ui = (global.chrome && chrome.i18n && typeof chrome.i18n.getUILanguage === 'function')
                ? chrome.i18n.getUILanguage()
                : '';
        } catch (_) {
            ui = '';
        }
        if (!ui && global.navigator) {
            ui = global.navigator.language || '';
        }
        return /^(ru|uk|be|kk)\b/i.test(ui) ? 'ru' : 'en';
    }

    function setLanguage(preference) {
        current = preference === 'ru' || preference === 'en' ? preference : detect();
        if (global.document && global.document.documentElement && global.document.querySelector && global.document.querySelector('.popup-shell')) {
            global.document.documentElement.lang = current;
        }
        return current;
    }

    function t(text, ...args) {
        const source = String(text == null ? '' : text);
        const dict = DICTS[current];
        const translated = dict && Object.prototype.hasOwnProperty.call(dict, source) ? dict[source] : source;
        return translated.replace(/\{(\d+)\}/g, (match, index) => (args[index] !== undefined ? String(args[index]) : match));
    }

    // Translates static markup. The Russian original is remembered per node,
    // so switching language back and forth always starts from the source.
    const originals = new WeakMap();
    const ATTRS = ['title', 'placeholder', 'aria-label'];

    function translateDom(root) {
        if (!root || !global.document) {
            return;
        }
        const walker = global.document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
            nodes.push(walker.currentNode);
        }
        nodes.forEach((node) => {
            const parent = node.parentElement;
            if (!parent || /^(SCRIPT|STYLE|TEXTAREA)$/.test(parent.tagName) || parent.closest('[data-i18n-skip]')) {
                return;
            }
            if (!originals.has(node)) {
                originals.set(node, node.nodeValue);
            }
            const source = originals.get(node);
            const trimmed = source.replace(/\s+/g, ' ').trim();
            if (!trimmed || !/[А-Яа-яЁё]/.test(trimmed)) {
                return;
            }
            const lead = source.match(/^\s*/)[0];
            const tail = source.match(/\s*$/)[0];
            node.nodeValue = lead + t(trimmed) + tail;
        });
        (root.querySelectorAll ? root : global.document).querySelectorAll('[title], [placeholder], [aria-label]').forEach((el) => {
            ATTRS.forEach((attr) => {
                if (!el.hasAttribute(attr)) {
                    return;
                }
                const key = 'i18nOrig' + attr.replace(/-./g, (m) => m[1].toUpperCase()).replace(/^./, (m) => m.toUpperCase());
                if (!(key in el.dataset)) {
                    el.dataset[key] = el.getAttribute(attr);
                }
                const source = el.dataset[key];
                if (/[А-Яа-яЁё]/.test(source)) {
                    el.setAttribute(attr, t(source));
                }
            });
        });
    }

    setLanguage('auto');

    global.ParamExtI18n = {
        t,
        setLanguage,
        language: () => current,
        translateDom
    };
})(globalThis);
