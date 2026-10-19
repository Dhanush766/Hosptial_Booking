# Hospital Appointment Booking System

A full-stack web application to manage **doctors, patients and appointment bookings**.

* **Backend:** Python, Django, **Django REST Framework** (REST API), **MySQL**
* **Frontend:** **React.js** (Vite), HTML5, CSS3, **Bootstrap 5**, React Router

The React app is a separate single-page application that talks to the Django API over HTTP/JSON using token authentication.

> **Verification status (please read):** The project includes 54 automated backend tests (`backend/clinic/tests/`). The code was syntax-checked, and imports, URL names and file references were cross-checked. **The test-suite, the API and the React app were NOT executed** by the person who generated this project, because neither Python nor npm packages could be downloaded in that environment. Run the steps in sections 4-6 on your own machine and record your results in section 10. Do not describe the project as "tested" until you have done that.

---

## 1. Features

| Area | Features |
|------|----------|
| Authentication | Login/logout with token authentication; login rate-limited to 10 attempts per minute; session expiry handled |
| Doctors | List, add, edit, delete; search (name, specialization, email); filter by availability; availability flag |
| Patients | List, add, edit, delete; search (name, email, phone); filter by gender; age calculated from date of birth |
| Appointments | Book, edit, reschedule, mark completed, cancel, delete; search; filter by status, doctor and date |
| Booking rules | No past dates; appointment hours 09:00-18:00; a doctor cannot be double-booked (cancelled slots can be reused); unavailable doctors cannot be booked |
| Dashboard | Totals, today's appointments, status breakdown, upcoming appointments, busiest doctors |
| Validation | Server-side in DRF serializers and model validators (phone, e-mail, name, fee, dates); errors shown per field in React |
| Security | Token auth on every endpoint, only admins (staff) can delete, doctors/patients with appointments cannot be deleted (HTTP 409), secrets in `.env` |
| Admin | Django Admin at `/admin/` |
| Responsive UI | Bootstrap grid, collapsible navbar, scrollable tables, works on phone widths |

### Who can do what

| Action | Not logged in | Logged-in user | Admin (staff) |
|--------|---------------|----------------|----------------|
| Read, create, update records | no (401) | yes | yes |
| Delete records | no (401) | **no (403)** | yes |

Create an admin with `createsuperuser`. Create a normal user in the Django Admin (leave "Staff status" unticked); they can sign in to the React app but see no delete buttons and the API refuses delete requests.

---

## 2. Folder structure

```
hospital-appointment-booking-system/
|-- README.md
|-- .gitignore
|-- docs/PROJECT_GUIDE.md        <- architecture, ER diagram, abstract, report outline, demo script, interview Q&A
|-- backend/                     <- Django + Django REST Framework
|   |-- manage.py
|   |-- requirements.txt
|   |-- .env.example             <- copy to .env and fill in
|   |-- config/                  <- settings.py, urls.py, wsgi.py, asgi.py
|   `-- clinic/
|       |-- models.py            <- Doctor, Patient, Appointment
|       |-- validators.py        <- reusable field validators
|       |-- serializers.py       <- JSON <-> models + all validation rules
|       |-- views.py             <- API endpoints, login/logout, dashboard
|       |-- permissions.py       <- "only admins may delete"
|       |-- pagination.py        <- 10 per page, ?page_size=N (max 100)
|       |-- urls.py              <- routes under /api/
|       |-- admin.py
|       |-- migrations/0001_initial.py
|       |-- management/commands/seed_demo_data.py
|       `-- tests/ (base, test_auth, test_doctors_patients, test_appointments, test_dashboard_and_commands)
`-- frontend/                    <- React (Vite)
    |-- package.json  vite.config.js  index.html
    `-- src/
        |-- main.jsx  App.jsx  api.js  utils.js  index.css
        |-- auth/AuthContext.jsx        <- login state + token
        |-- hooks/ (usePaginated.js, useDebounce.js)
        |-- components/ (Layout, ProtectedRoute, FormModal, ConfirmModal, Pagination, Toasts, StatusBadge, Spinner)
        `-- pages/ (Login, Dashboard, Doctors, Patients, Appointments, NotFound)
```

> **Naming note:** the project is called *Hospital Appointment Booking System*, but the Django app folder is named `clinic` internally (a code name). That is why imports read `clinic.models` and the MySQL tables are called `clinic_doctor`, `clinic_patient` and `clinic_appointment`. It does not affect how the project runs.

## 3. REST API

Base URL `http://127.0.0.1:8000/api/`. Send `Authorization: Token <key>` on every call except login. Lists are paginated: `{count, next, previous, results}`.

| Method and path | Purpose |
|-----------------|---------|
| `POST /auth/login/` | `{username, password}` -> `{token, username, is_staff}` |
| `POST /auth/logout/` | Invalidate the token |
| `GET /auth/me/` | Current user |
| `GET /dashboard/` | Dashboard numbers |
| `GET, POST /doctors/` | List (`?search=&available=true\|false&specialization=&page=`) / create |
| `GET, PUT, PATCH, DELETE /doctors/<id>/` | Detail / update / delete (admin) |
| `GET, POST /patients/` | List (`?search=&gender=M\|F\|O&page=`) / create |
| `GET, PUT, PATCH, DELETE /patients/<id>/` | Detail / update / delete (admin) |
| `GET, POST /appointments/` | List (`?search=&status=&doctor=<id>&patient=<id>&date=YYYY-MM-DD&page=`) / book |
| `GET, PUT, PATCH, DELETE /appointments/<id>/` | Detail / update / delete (admin) |

Status codes: 200/201 success, 204 deleted, 400 validation error (field-by-field), 401 not logged in, 403 not allowed, 404 not found, 409 cannot delete (has appointments), 429 too many login attempts.

---

## 4. Installation on Windows

**Prerequisites:** Python 3.10+, Node.js 18+ (LTS) with npm, MySQL Server 8.x, Git. Check with `python --version`, `node --version`, `npm --version`.

### 4.1 Backend

```bat
cd path\to\hospital-appointment-booking-system\backend
python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```
*PowerShell blocks the activate script?* Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` or use Command Prompt.

**Create the MySQL database and user** (Workbench or `mysql -u root -p`; choose your own strong password):
```sql
CREATE DATABASE hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hospital_user'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
GRANT ALL PRIVILEGES ON hospital_db.* TO 'hospital_user'@'localhost';
GRANT ALL PRIVILEGES ON test_hospital_db.* TO 'hospital_user'@'localhost';
FLUSH PRIVILEGES;
```

**Configure secrets:**
```bat
copy .env.example .env
```
Edit `.env`: set `DJANGO_SECRET_KEY` (generate with `python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"`), `DB_NAME`, `DB_USER`, `DB_PASSWORD`. `.env` is ignored by Git.

**Check, migrate, create users, load demo data:**
```bat
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_demo_data
python manage.py runserver
```
`makemigrations --check` confirms the hand-written migration matches the models; if it reports changes, run `python manage.py makemigrations` and keep the new file. The API is now at <http://127.0.0.1:8000/api/> and Django Admin at <http://127.0.0.1:8000/admin/>. Leave this window open.

### 4.2 Frontend (second terminal)

```bat
cd path\to\hospital-appointment-booking-system\frontend
npm install
npm run dev
```
Open <http://localhost:5173> and log in with the superuser you created. Vite forwards `/api` requests to Django on port 8000, so no CORS configuration is needed in development.

For a production build: `npm run build` creates `frontend/dist/`, which can be served by any web server (route `/api` to Django).

---

## 5. Run the tests

```bat
cd backend
python manage.py test
```
For a quick run without MySQL: `set DB_ENGINE=sqlite` first (PowerShell: `$env:DB_ENGINE="sqlite"`). Single groups: `python manage.py test clinic.tests.test_appointments`.

The tests cover login/logout/token handling and rate-limiting, doctor/patient/appointment CRUD, input normalisation and validation, double-booking, past dates, hospital appointment hours, unavailable doctors, search and filters, pagination, delete protection (409), admin-only delete (403), dashboard numbers and the demo-data command. There are no automated tests for the React frontend; test it with the checklist below.

## 6. Manual verification checklist

- [ ] Wrong password shows an error; correct login opens the dashboard
- [ ] Logout returns to the login page; opening `/doctors` afterwards redirects to login
- [ ] Dashboard numbers match the lists
- [ ] Add a doctor; try invalid input (phone `123`, fee `0`, duplicate e-mail) - messages appear under the fields
- [ ] Add and edit a patient; future date of birth is rejected
- [ ] Book an appointment; try a past date, a time outside 09:00-18:00, and the same doctor/time twice
- [ ] Mark an appointment completed; cancel another (confirmation dialog appears)
- [ ] Search and filter doctors, patients and appointments; Reset clears filters
- [ ] Pagination works when there are more than 10 rows (add rows or use `?page_size`)
- [ ] Try deleting a doctor who has appointments - blocked with a message
- [ ] Log in as a non-admin user: no delete buttons are shown
- [ ] Resize the browser to phone width: menu collapses, tables scroll sideways
- [ ] Stop Django while the app is open and reload a list - a clear "cannot reach the server" message appears

## 7. Common errors and solutions

| Error | Cause and fix |
|-------|---------------|
| `ImproperlyConfigured: Environment variable ... is not set` | Create `backend\.env` from `.env.example` and fill it in |
| `OperationalError (1045) Access denied for user` | Wrong `DB_USER`/`DB_PASSWORD`, or the user was not created |
| `OperationalError (1049) Unknown database` | Create `hospital_db` (section 4.1) or fix `DB_NAME` |
| `OperationalError (2003) Can't connect to MySQL server` | Start the MySQL80 service in Windows *Services* |
| `pip install mysqlclient` fails (needs Visual C++ / pkg-config) | Upgrade pip so a pre-built wheel is used, or use a Python version that has one |
| `ModuleNotFoundError: No module named 'rest_framework'` | Virtual environment not active or `pip install -r requirements.txt` not run |
| `npm` is not recognised | Install Node.js LTS and reopen the terminal |
| React page loads but lists show "Cannot reach the server" | Django is not running on port 8000, or Vite was started in the wrong folder |
| `401` right after login | Browser has an old token; log out, or clear site data for `localhost:5173` |
| Browser shows `ECONNREFUSED` in the Vite terminal | Start the Django server first |
| Tests: `Access denied ... test_hospital_db` | Run the second `GRANT` statement, or test with `DB_ENGINE=sqlite` |
| `Your models have changes that are not yet reflected in a migration` | `python manage.py makemigrations` then `migrate` |
| Port already in use | `python manage.py runserver 8001` (and change the proxy target in `vite.config.js`) |

## 8. Upload to GitHub

```bat
cd path\to\hospital-appointment-booking-system
git init
git add .
git status
```
Check that `.env`, `venv/` and `node_modules/` do **not** appear in `git status`. Then:
```bat
git commit -m "Initial commit: Hospital Appointment Booking System"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/doctor-appointment-system.git
git push -u origin main
```
(Create the empty repository on github.com first, without a README.) If you ever commit `.env` by mistake, change your MySQL password and secret key immediately - deleting the file later does not remove it from Git history.

## 9. Known limitations

* The login token is kept in the browser's `localStorage`: simple, but readable by any script injected into the page (XSS). React escapes output by default, and there is no `dangerouslySetInnerHTML`. HTTP-only cookies would be stronger.
* Double-booking is prevented by a check in the serializer; two requests at exactly the same moment could both pass. A production system would add a database lock or constraint.
* No audit log, no e-mail/SMS reminders, no doctor schedules or time-slot lengths, no patient self-service login.
* Tokens never expire until logout. Salary-like sensitive data is not stored; medical notes are visible to every logged-in user.
* There are no frontend (React) automated tests.
* `0001_initial.py` was written by hand; `makemigrations --check` confirms it matches the models.

## 10. My verification results (fill in yourself)

| Check | Date | Result |
|-------|------|--------|
| `python manage.py check` | | |
| `python manage.py test` (database used: ) | | |
| `npm run build` | | |
| Manual checklist (section 6) | | |
