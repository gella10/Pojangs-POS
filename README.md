# Pojang Backend
Express 5 + PostgreSQL API for the Pojangmacha Order and Sales Logging System (IPT 102 SRS v1.0).

## Folder structure
```
src/
  server.js              start-up: seed accounts, then listen
  app.js                 builds the Express app (security, CORS, routes, errors)
  config/                db.js (pool) · constants.js (business rules)
  middleware/            auth.js (sessions + guard) · errorHandler.js
  utils/helpers.js       validation, dates, password hashing
  controllers/           auth · menu · order · report (the logic)
  routes/                one file per area, mounted under /api
db/schema.sql            tables + starting menu
scripts/init-db.js       runs schema.sql (npm run db:init)
tests/api.test.js        B-T1..B-T9, fake database
```
Flow of a request: `routes` -> `middleware/auth` (who are you?) -> `controller` (validate, query) -> JSON. Errors go to `errorHandler`.

## Run
```
cp .env.example .env     # fill in DATABASE_URL and passwords
npm install
npm run db:init          # creates tables and the menu
npm run dev              # http://localhost:4000/api/health
npm test
```
## Endpoints
Public: `GET /api/health` · `POST /api/auth/login` · `POST /api/auth/register` (staff only)
Signed in: `GET /api/menu` · `GET /api/menu/:id` · `POST /api/orders`
Owner only: `POST /api/menu` · `PUT /api/menu/:id` · `PUT /api/menu/:id/price` · `PATCH /api/menu/:id/availability` · `PUT /api/combos/:code` · `DELETE /api/menu/:id` (hides) · `GET /api/orders?date=` · `PATCH /api/orders/:id` · `GET /api/sales/daily?date=` · `GET /api/sales/history` · `POST /api/cash-counts` · `GET /api/reconciliation?date=`
Errors are always `{ "error": "message" }` (400 invalid, 401 sign in, 403 owner only, 404, 409 conflict, 423 locked).
