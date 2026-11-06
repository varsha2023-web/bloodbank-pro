# LifeLine Blood Bank (academic demonstration)
All data is fictional. The site does not sell blood and does not make medical decisions: donor eligibility,
screening and clinical compatibility are decided by qualified staff.

## Tech
HTML/CSS/JS + Bootstrap 5 + Chart.js (from CDN, so internet is needed) -> Express.js REST API -> MySQL 8.0.16+.

## Folder structure
database/schema.sql            tables, keys, constraints
backend/server.js              Express app (also serves ../frontend)
backend/config/db.js           MySQL pool
backend/middleware/            auth.js (JWT cookie, admin check, CSRF header), validate.js
backend/routes/                auth, public, user, admin (all controllers are inside the route files)
backend/scripts/               createAdmin.js, seed.js (fictional data)
frontend/                      index, login, admin-login, register, user (dashboard), admin (dashboard) + css/js
docs/test-plan.md              manual test cases

## Run it (Windows, easiest way)
1. Install Node.js LTS and MySQL 8.0.16+ (nodejs.org, dev.mysql.com). Make sure the MySQL service is running.
2. Extract the zip somewhere simple, e.g. C:\bloodbank-pro
3. Open backend\.env in Notepad and type your MySQL root password after DB_PASSWORD=  (save the file).
4. Double-click start.bat. It installs packages, creates the database, admin account and sample data, starts the server
   and opens http://localhost:3000 in your browser. Keep the black window open while you use the site.
Logins: user demo asha@example.com / Demo@1234 (or register)  |  admin: /admin-login.html  admin@example.com / Admin@12345
Manual alternative (inside backend/): npm install, npm run setup, npm run dev.

## Rules built in
- Public stock = Passed screening AND not expired AND units > 0. Pending/failed/expired never show as available.
- Request statuses only move along allowed steps; Approve is blocked if eligible stock is short.
- Issuing runs in one database transaction (locks the request and batch, checks group/component/expiry/quantity, writes the issue + audit rows). Negative stock is also blocked by a database CHECK.
- Passwords are bcrypt-hashed; login uses an HttpOnly SameSite=Strict cookie; login is rate-limited (10 tries / 15 min);
  all SQL is parameterised; admin actions are written to admin_logs.

## Troubleshooting
- "ER_ACCESS_DENIED": wrong DB_USER/DB_PASSWORD in .env.   - "ER_BAD_DB_ERROR": schema.sql not run yet.
- "Cannot find module": run `npm install` inside backend/.   - Blank charts: no internet (Chart.js CDN).
- Port in use: change PORT in .env.   - Checks do nothing on MySQL older than 8.0.16: upgrade MySQL.
- Logged out unexpectedly: the login token lasts 2 hours (JWT_EXPIRES_IN).

## Known limits
No automated tests, no donation-to-inventory auto-link UI (batch form has no donation field), no city filter on stock
(inventory has no city), no edit-inventory-quantity screen (only issue), contact form is not rate-limited, no HTTPS setup.
