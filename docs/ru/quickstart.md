# Быстрый старт

`playwright-ui-smoke-kit` добавляет в проект простой браузерный smoke-тест на Playwright.

Сгенерированный GitHub Actions workflow по умолчанию экономит минуты: не дублирует запуск на `push` и `pull_request`, отменяет устаревшие запуски, пропускает docs-only изменения и использует короткий timeout.

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

## Browser task artifacts

Для повторяемых браузерных задач, где нужен проверяемый артефакт, используйте отдельный workflow:

Обычный route smoke отвечает на вопрос "страница открылась и показала маркер".
Artifact mode отвечает на вопрос "важная браузерная задача доказана, есть
повторяемый скрипт, журнал, снимки и проверка результата".

```bash
npx playwright-ui-smoke-kit artifact-init \
  --task-id customer-new-task-proof \
  --title "Customer new task proof" \
  --source "http://127.0.0.1:5173/customer/new-task"
```

После заполнения `task.md`, `plan.md` и `final_script.*` запустите скрипт:

```bash
npx playwright-ui-smoke-kit artifact-run .tmp/browser-task-artifacts/customer-new-task-proof -- --user customer-a
```

Проверка готового доказательства:

```bash
npx playwright-ui-smoke-kit artifact-check .tmp/browser-task-artifacts/customer-new-task-proof --strict
```

Строгий режим требует `status=verified`, непустые `critical_points` и `evidence_refs`, результат, снимок экрана и чистый `verification.md` без черновых маркеров.

Этот режим полезен для сложного пользовательского пути, визуального proof,
повторяемого web workflow или задачи, которую позже можно превратить в
обычный Playwright e2e/smoke-тест. Не смешивайте его с базовым route smoke:
быстрый CI-слой должен оставаться маленьким.

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
- Для монорепозиториев добавляйте shared-пути через `--workflow-path "packages/ui/**"`.
- Если workflow должен запускаться на любое изменение, используйте `--workflow-all-changes`.
- Не делайте path-filtered browser workflow единственным обязательным check в branch protection; для этого нужен отдельный always-running gate.
