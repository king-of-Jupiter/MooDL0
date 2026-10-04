<h1 align="center">
  <img src="logo_main.png" alt="MooDuSh" width="38" height="38" style="vertical-align: middle;">
  MooDuSh — Enhanced SyncShare
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome%20Web%20Store-Available-brightgreen?style=flat-square" alt="Chrome Web Store">
  <img src="https://img.shields.io/badge/Manifest%20V3-Compatible-blue?style=flat-square" alt="Manifest Version">
  <img src="https://img.shields.io/badge/Version-2.9.6-orange?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT%20with%20Attribution-green?style=flat-square" alt="License">
</p>

> **MooDuSh** — расширенная версия SyncShare для автоматизации тестов на **Moodle**.

---

## Возможности

### Moodle

| Режим | Описание |
|-------|----------|
| **Палочка (Wand)** | Показывает кнопку рядом с каждым вопросом. Нажмите, чтобы увидеть статистику и выбрать ответ. |
| **Авто-вставка (Auto-Insert)** | Автоматически заполняет ответы на основе статистики сразу при открытии теста. |
| **Авто-прорешивание (Auto-Solve)** | Решает весь тест и автоматически переходит на следующие страницы. |

---

## Установка расширения

### Шаг 1: Скачайте расширение

Откройте последний [**GitHub Release**](https://github.com/KOSFin/MooDuSh/releases/latest) и скачайте `moodush-extension.zip`. Распакуйте архив в удобное место.

Для разработки можно клонировать репозиторий:

```bash
git clone https://github.com/KOSFin/MooDuSh-from-syncshare.git
cd MooDuSh-from-syncshare
npm ci
npm run build:extension
```

### Шаг 2: Загрузите в Chrome

1. Откройте `chrome://extensions/`
2. Включите **Режим разработчика** (переключатель в правом верхнем углу)
3. Нажмите **Загрузить распакованное расширение**
4. Выберите папку с файлами MooDuSh (где лежит `manifest.json`)
5. Готово — иконка MooDuSh появится на панели расширений

> **Примечание:** MooDuSh автоматически заменит оригинальное расширение SyncShare, если оно установлено, так как оба используют одинаковые ключи Chrome. Весь функционал SyncShare сохраняется.

---

## Обновление

Если расширение установлено как unpacked-папка, обновите его внешним скриптом:

```bash
./scripts/update.sh
```

На Windows:

```powershell
.\scripts\update.ps1
```

После обновления откройте `chrome://extensions/` и нажмите кнопку обновления у MooDuSh. Само расширение не перезаписывает свою папку из Chrome — это делает только внешний скрипт, запущенный пользователем.

---

## Настройка для Moodle

Moodle работает сразу после установки без дополнительной настройки.

1. Нажмите на иконку MooDuSh
2. Примите политику в первом экране popup
3. Выберите режим:
   - **Палочка** — кнопка рядом с каждым вопросом (по умолчанию)
   - **Авто-вставка** — автоматическое заполнение ответов
   - **Авто-прохождение** — полная автоматизация (нажмите **Старт** для запуска)
4. Настройте горячие клавиши для палочки и вставки ответов
5. Нажмите **Сохранить**

В режиме **Авто-прохождение** можно отдельно включить переход к итогам после последней страницы и автоматическую отправку попытки. По умолчанию оба действия выключены. Если на странице итогов остались вопросы без ответа, отправка не выполняется.

Для очереди выберите `.txt` с одной полной ссылкой на `mod/quiz/view.php?id=...` на строку (все ссылки — с одного Moodle-сайта), затем нажмите **Запустить очередь**. Расширение использует активную вкладку: открывает тест, запускает попытку, решает, отправляет и переходит к следующей ссылке только после открытия страницы результата текущей попытки. Очередь автоматически включает завершение и отправку независимо от переключателей одиночного режима. При отсутствии ответа, недоступной попытке или форме предварительного ввода очередь останавливается; ручной ввод и повторный запуск — через интерфейс Moodle. Кнопка **Остановить очередь** прерывает дальнейшие автоматические переходы. Не запускайте очередь в вкладке с незавершённой работой: первая ссылка заменит текущую страницу.

Строки, начинающиеся с `#` (после пробелов), считаются комментариями и игнорируются при импорте. Можно подписывать ссылки отдельной строкой, например `# Тест 2.1`. Готовый список тестов 2.1–8.10: `moodle_quizzes_2.1-8.10.txt`.

---

## Бэкенд

Отдельный бэкенд не требуется: расширение работает с публичным Moodle API.

```bash
cp env.example .env
```

В `.env` при необходимости поменяйте только:

```dotenv
MOODLE_API_BASE_URL=https://syncshare.naloaty.me/api
```

Свой URL backend также можно задать прямо в popup: раздел **Подключение и диагностика** → **Использовать свой backend**.

---

## GitHub Actions и релизы

Workflow `.github/workflows/extension.yml` собирает `moodush-extension.zip` и публикует Release только по tag `v*` или ручному запуску.

### Repository Variables

| Variable | Пример | Назначение |
|----------|--------|------------|
| `MOODLE_API_BASE_URL` | `https://syncshare.naloaty.me/api` | Публичный URL Moodle backend |
| `BOT_LINK` | `https://t.me/paramext_bot` | Ссылка на Telegram-бота (опционально) |
| `UPDATE_CHECK_URL` | `https://syncshare.naloaty.me/api/v2/update` | Endpoint проверки обновлений |
| `RELEASE_PUBLIC_KEY` | публичный PEM/ключ | Публичный ключ проверки release manifest |

### Repository Secrets

| Secret | Назначение |
|--------|------------|
| `RELEASE_SIGNING_PRIVATE_KEY` | Приватный ключ для подписи `release-manifest.json` |

Во frontend build config нельзя добавлять секретные API-токены: все, что попадает в `js/build_config.js`, видно пользователю расширения.

---

## Команды Telegram-бота

| Команда | Описание |
|---------|----------|
| `/start` | Регистрация и получение персонального токена |
| `/token` | Показать текущий токен + кнопка перегенерации |
| `/stats` | Статистика: количество тестов, вопросов и правильных ответов |
| `/help`  | Справка по командам и настройке |

---

## Настройки API

В разделе **Подключение и диагностика** в popup можно настроить подключение к бэкенду Moodle:

- **Использовать свой backend** — включить переопределение URL сервера
- **Moodle API URL** — URL сервера (по умолчанию `https://syncshare.naloaty.me/api`)
- **Сбросить URL** — сброс адреса API к значению по умолчанию

---

## Структура проекта

```text
MooDuSh/
  manifest.json          — конфигурация расширения (Manifest V3)
  env.example            — пример переменных окружения
  scripts/update.sh      — удобное обновление через Git
  js/
    popup_new.js         — логика popup-окна расширения
    platform_settings.js — управление настройками
    content_logic.js     — контент-скрипт для Moodle
    background_worker.js — фоновый Service Worker
    commons.js           — общие утилиты
    quiz_attempt.js      — обработка попыток Moodle
    quiz_board.js        — доска вопросов Moodle
    quiz_overview.js     — обзор теста Moodle
  html/
    popup/               — HTML popup-окна
  css/
    popup/               — стили popup
    widgets/             — стили виджетов (контекстное меню)
  _locales/              — локализация (ru, en)
```

---

## FAQ

**В: Кнопки палочки не появляются**
О: Убедитесь, что вы находитесь на странице теста. Попробуйте обновить страницу. Проверьте, что палочка не скрыта горячей клавишей.

**В: Как обновить расширение?**
О: Если скачивали через Git, выполните `./scripts/update.sh`, затем обновите расширение в `chrome://extensions/`.

**В: Как вернуться на оригинальный SyncShare?**
О: Удалите MooDuSh из `chrome://extensions/` и установите [SyncShare из Chrome Web Store](https://chromewebstore.google.com/detail/syncshare/lngijbnmdkejbgnkakeiapeppbpaapib?hl=ru&utm_source=ext_sidebar).

**В: Авто-прорешивание не переходит на следующую страницу (Moodle)**
О: Проверьте, что текст кнопки «Далее» в настройках совпадает с текстом на странице (по умолчанию «Следующая страница»).

---

## Проблемы и предложения

Если что-то не работает или есть идеи по улучшению — создайте issue в репозитории:

**[GitHub Issues](https://github.com/KOSFin/MooDuSh-from-syncshare/issues)**

Пожалуйста, опишите:
- Что именно не работает
- Ссылку на тест Moodle (без персональных данных)
- Скриншот ошибки из консоли (F12 -> Console), если есть

---

Если расширение вам помогло, поставьте звезду на GitHub — это очень мотивирует продолжать разработку!

<div align="center">

**Made with ❤️ by MooDuSh contributors**

[Оригинальный SyncShare](https://chromewebstore.google.com/detail/syncshare/lngijbnmdkejbgnkakeiapeppbpaapib?hl=ru&utm_source=ext_sidebar)

</div>
