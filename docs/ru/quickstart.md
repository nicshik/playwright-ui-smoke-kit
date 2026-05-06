# Быстрый старт

`playwright-ui-smoke-kit` добавляет в проект простой браузерный smoke-тест на Playwright.

Основная команда:

```bash
npx playwright-ui-smoke-kit init
```

Для монорепозитория используйте отдельные пути:

```bash
npx playwright-ui-smoke-kit init \
  --yes \
  --repo-root . \
  --app-dir apps/web \
  --template vite-app \
  --route "/::Home"
```

Для запуска без вопросов:

```bash
npx playwright-ui-smoke-kit init \
  --yes \
  --template vite-app \
  --web-command "npm run dev -- --host 127.0.0.1" \
  --web-port 5173 \
  --route "/::Home"
```

После установки:

```bash
npm run smoke:web-ui
```

Для других пакетных менеджеров:

```bash
pnpm run smoke:web-ui
yarn smoke:web-ui
bun run smoke:web-ui
```

Проверить установленную настройку:

```bash
npx playwright-ui-smoke-kit doctor
```

Добавить маршрут:

```bash
npx playwright-ui-smoke-kit add-route "/dashboard::Dashboard"
```

## Что появится в проекте

```text
playwright.config.ts
tests/ui-smoke.spec.ts
.github/workflows/playwright-ui-smoke.yml
```

В `package.json` появится скрипт:

```json
{
  "scripts": {
    "smoke:web-ui": "playwright test"
  }
}
```

## Маршруты

Маршруты задаются так:

```bash
--route "/dashboard::Dashboard"
```

Слева путь, справа видимый текстовый маркер на странице. Тест открывает страницу, ждёт маркер и падает, если в браузере появились `console.error` или необработанные ошибки страницы.

## Важные правила

- Playwright ставится локально в проект, не глобально.
- Первый уровень проверки запускает только Chromium.
- Smoke-тесты не должны менять состояние приложения.
- Полные пользовательские сценарии лучше добавлять отдельно, после базовой проверки маршрутов.
