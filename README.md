[README.md](https://github.com/user-attachments/files/33570052/README.md)
# Норма

Мобильный веб-сервис заказа готового рациона на день или на неделю. Город запуска — Москва. Первая доставка не раньше чем через два календарных дня. Четыре типа питания, без конструктора блюд и без своей курьерской службы.

Приложение: [Норма](http://127.0.0.1:38471)

## Запуск

Нужны Node.js 22 и PostgreSQL 16.

```bash
cp .env.example .env.local
```

В `.env.local` задайте `APP_DB_PASSWORD` и тот же пароль в `DATABASE_URL`. Для локального сервера PostgreSQL:

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
npm install
npm run db:init
npm run dev
```

Сервер разработки слушает порт **38471**.

Демо-вход после `npm run db:init`: `demo@norma.test` / `Demo12345`.

Тестовая карта: `4242 4242 4242 4242`, любой будущий срок, CVV из трёх цифр. Отказ банка: `4000 0000 0000 0002`.

Проверки:

```bash
npm test
```

Повторный `npm run db:init` пересобирает схему и стирает заказы.

Docker-вариант описан в `docker-compose.yml` и `docker/postgres/Dockerfile`. На машине без демона Docker используйте локальный PostgreSQL, как выше.

## Что внутри

- Путь пользователя: `user_journey.md`
- Истории и критерии: `user_stories.md`
- Требования и ошибки: `technical_specification.md`
- Описание продукта: `project_description.md`
- Концепции экрана: `ui_concepts/ui_description.md`
- Сравнение агентов: `dz1_report.md`
- Правила и промпты: `rules.md`, `prompt_templates.md`, `prompt_methodology.md`, `testing.md`
- Отчёт по интерфейсу: `development_report.md`
- API и база: `backend_documentation.md`

Задание про CI/CD, OAuth, аналитику и боевые платежи в этот репозиторий не входило.

## Основные адреса

- `/` — первый экран
- `/onboarding` — как устроен заказ
- `/rations` — тип питания и наборы
- `/checkout` — дата и адрес
- `/login` и `/register`
- `/orders` — свои заказы
- `/concepts` — три черновика экрана
