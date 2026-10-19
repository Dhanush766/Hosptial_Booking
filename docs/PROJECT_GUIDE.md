# Hospital Appointment Booking System - Project Guide

This guide helps you **understand, present and defend** the project. Setup and run steps are in `README.md`.

**Honest status note:** the code was written and statically checked (syntax, imports, URL names), but the automated tests, the API and the React app have **not** been executed by the generator. Run them yourself and record the results (README section 10) before presenting. Never say something "was tested" unless you ran it.

---

## 1. Project overview

A web application for a hospital front desk. Staff log in, keep a directory of **doctors** and **patients**, and **book, reschedule, complete or cancel appointments**. A dashboard summarises the hospital's activity. The system has two parts that communicate through a REST API:

* **Django REST Framework backend** - owns the data (MySQL), enforces the rules, handles security.
* **React frontend** - the user interface (Bootstrap-styled), which calls the API.

**One-sentence pitch:** *"A full-stack hospital appointment booking app: a Django REST API with MySQL and token authentication, and a responsive React + Bootstrap interface for managing doctors, patients and appointment bookings."*

## 2. Problem statement and objectives

**Problem:** Hospitals often track appointments in paper diaries or spreadsheets, which causes double bookings, lost patient details and no overview of the day's workload.

**Objectives**
1. Store doctor, patient and appointment data centrally in MySQL.
2. Expose the data through a documented REST API (Django REST Framework).
3. Prevent booking mistakes automatically (past dates, outside hospital appointment hours, doctor already booked, doctor unavailable).
4. Provide a fast, responsive interface (React + Bootstrap) with search, filters and pagination.
5. Protect the data with authentication, role-based deletion rights and server-side validation.
6. Support maintenance with automated backend tests.

**Out of scope / future work:** patient self-service portal, e-mail/SMS reminders, doctor working-hour schedules, billing, prescriptions.

## 3. System architecture

```
 Browser
 +--------------------------------------------+
 |  React app (Vite dev server :5173)         |
 |  pages -> api.js (fetch + Token header)    |
 +----------------------|---------------------+
                        |  HTTP + JSON   (/api/... proxied to Django in development)
                        v
 +--------------------------------------------+
 |  Django + Django REST Framework (:8000)    |
 |   urls.py  ->  views (ViewSets)            |
 |                 |  permissions, throttling |
 |                 v                          |
 |            serializers (validation)        |
 |                 |                          |
 |                 v                          |
 |            models (ORM)                    |
 +----------------------|---------------------+
                        v
                  MySQL database
```

### Request flow: "Book an appointment"
1. User fills the modal form in `Appointments.jsx` and clicks Save.
2. `api.post("/appointments/", values)` sends JSON with the header `Authorization: Token <key>`.
3. DRF's `TokenAuthentication` identifies the user (otherwise **401**). `StaffOnlyDelete` allows POST for any logged-in user.
4. `AppointmentSerializer` validates every field, then `validate()` applies the business rules: not in the past, doctor available, doctor not already booked at that time.
5. Valid -> the ORM saves a row, the API answers **201** with the new appointment (including patient and doctor names). Invalid -> **400** with `{"field": ["message"]}`.
6. `FormModal` shows each message under its field; on success the list reloads and a success toast appears.

### Security layers
| Threat | Protection |
|--------|------------|
| Anonymous access | `IsAuthenticated` is the default permission for every endpoint |
| Unauthorised deletes | `StaffOnlyDelete` permission -> 403 for non-admins (buttons are also hidden in React, but the server is what enforces it) |
| Brute-force login | `ScopedRateThrottle`: 10 login attempts/minute (429 afterwards) |
| Bad or malicious input | Server-side validation in serializers/model validators; the ORM uses parameterised queries (no SQL injection) |
| XSS | React escapes rendered text; no `dangerouslySetInnerHTML` is used |
| Secrets in code | Secret key and DB credentials from environment variables (`.env`, ignored by Git) |
| Orphaned data | `on_delete=PROTECT` on appointment foreign keys; the API returns 409 instead of crashing |
| Token theft | Token stored in `localStorage` - a known trade-off (see README section 9); logout deletes the token on the server |
| CSRF | Not applicable to token-in-header authentication (browsers do not attach the header automatically) |

## 4. Folder structure and file reference

See README section 2 for the tree.

| File | Purpose | Depends on |
|------|---------|------------|
| `backend/config/settings.py` | Settings, MySQL config, DRF config, hospital appointment hours | `.env`, python-dotenv |
| `backend/config/urls.py` | `/admin/` and `/api/` | `clinic.urls` |
| `backend/clinic/models.py` | `Doctor`, `Patient`, `Appointment` tables | `validators.py` |
| `backend/clinic/validators.py` | Phone, name, amount, birth-date rules | - |
| `backend/clinic/serializers.py` | Validation + JSON conversion; `NormalizeInputMixin` cleans e-mail/phone | `models.py`, settings |
| `backend/clinic/views.py` | ViewSets, login/logout/me, dashboard | serializers, permissions |
| `backend/clinic/permissions.py` | Admin-only delete | - |
| `backend/clinic/pagination.py` | Page size 10, `?page_size` up to 100 | - |
| `backend/clinic/urls.py` | API routes | views |
| `backend/clinic/admin.py` | Django Admin screens | models |
| `backend/clinic/management/commands/seed_demo_data.py` | Fictional demo data | models |
| `backend/clinic/tests/*` | 54 automated tests | everything above |
| `frontend/src/api.js` | `fetch` wrapper: token header, errors, 401 handling | - |
| `frontend/src/auth/AuthContext.jsx` | Login state shared by all pages | `api.js` |
| `frontend/src/hooks/usePaginated.js` | Loads a paginated list when filters change | `api.js` |
| `frontend/src/components/FormModal.jsx` | Reusable add/edit form driven by a field list; shows server errors per field | `api.js` |
| `frontend/src/pages/*.jsx` | One component per screen | components, hooks |
| `frontend/vite.config.js` | Dev server and `/api` proxy to Django | - |

## 5. Database design

*(The Django app is named `clinic` internally, so MySQL prefixes the table names with `clinic_`.)*

**clinic_doctor**: `id` PK, `full_name`, `email` (unique), `phone_number`, `specialization`, `experience_years` (0-60), `consultation_fee` DECIMAL(8,2) > 0, `is_available`, `created_at`.

**clinic_patient**: `id` PK, `full_name`, `email` (unique), `phone_number`, `date_of_birth` (not in future), `gender` (M/F/O), `address`, `medical_notes`, `created_at`.

**clinic_appointment**: `id` PK, `patient_id` FK, `doctor_id` FK (both `PROTECT`), `appointment_date`, `appointment_time`, `reason`, `status` (SCHEDULED / COMPLETED / CANCELLED), `notes`, `created_at`. Indexes on (date, time) and on status.

```
 +------------+ 1          N +----------------+ N          1 +------------+
 |  PATIENT   |--------------|  APPOINTMENT   |--------------|   DOCTOR   |
 +------------+  "books"     +----------------+  "attends"   +------------+
 | PK id      |              | PK id          |              | PK id      |
 |    email UQ|              | FK patient_id  |              |    email UQ|
 |    ...     |              | FK doctor_id   |              |    ...     |
 +------------+              |    date, time  |              +------------+
                             |    reason      |
                             |    status      |
                             +----------------+
```
Patients and doctors have a **many-to-many** relationship through appointments: one patient can see many doctors and one doctor sees many patients. `Appointment` is the junction table and carries its own data (date, time, reason, status).

*Why no database unique constraint on (doctor, date, time)?* A cancelled appointment must not block the slot, and MySQL does not support conditional unique indexes, so the rule is enforced in the serializer. The trade-off is listed under limitations.

## 6. Implementation plan (stages)

| Stage | What | Check it |
|-------|------|----------|
| 1 | Backend skeleton, settings, MySQL via `.env` | `python manage.py check` |
| 2 | Models, validators, migration | `python manage.py migrate`, inspect tables in Workbench |
| 3 | Serializers with business rules | `python manage.py test clinic.tests.test_appointments` |
| 4 | ViewSets, permissions, auth endpoints, dashboard | `python manage.py test`; try the API with a tool such as Postman |
| 5 | Admin and demo data | `createsuperuser`, `seed_demo_data`, open `/admin/` |
| 6 | React app: api layer, auth, layout, reusable components | `npm run dev` |
| 7 | Pages: login, dashboard, doctors, patients, appointments | work through README checklist |
| 8 | Documentation | - |

## 7. Mapping to your resume bullets

| Resume statement | Where it is in the project |
|------------------|----------------------------|
| "Developed a full-stack web application to manage doctor details, patient information and appointment bookings" | Doctors / Patients / Appointments pages (`frontend/src/pages`) backed by `clinic/models.py` |
| "Implemented REST APIs using Django REST Framework to manage doctors, patients and appointments" | `clinic/views.py` (`DoctorViewSet`, `PatientViewSet`, `AppointmentViewSet`), `serializers.py`, `urls.py` - table of endpoints in README section 3 |
| "Designed a responsive user interface using React.js, HTML5, CSS3 and Bootstrap" | React components in `frontend/src`; Bootstrap grid and components; `index.html` and `index.css` for HTML5/CSS3 |
| "with MySQL for data storage and retrieval" | `DATABASES` in `settings.py`; ORM queries in `views.py` |

Only keep a bullet on your resume if you can explain it and demonstrate it. After you have run the project, you can honestly add concrete details, for example the validation rules, token authentication, or search/filter/pagination. Avoid numbers you did not measure.

## 8. Testing procedure

```bat
cd backend
python manage.py test
```
Expected when everything passes: `Ran 54 tests in ...` then `OK`. If something fails, read the traceback from the bottom; the last lines name the failing assertion. Send me the full output and I will help fix it. Then run the frontend checklist (README section 6) and `npm run build` in `frontend`.

## 9. Final-year project abstract

> **Hospital Appointment Booking System - A Full-Stack Web Application using Django REST Framework and React**
>
> Hospitals that manage appointments on paper or in spreadsheets suffer from double bookings, scattered patient records and no overview of daily workload. This project presents a full-stack web application for managing doctors, patients and appointment bookings. The backend is built with Python, Django and Django REST Framework and exposes a token-authenticated REST API backed by a MySQL relational database. The frontend is a responsive single-page application built with React.js, HTML5, CSS3 and Bootstrap that consumes the API. The system supports creation, retrieval, update and deletion of doctor, patient and appointment records, with search, filtering and pagination. Server-side validation enforces valid contact details and dates, and booking rules prevent appointments in the past, outside hospital appointment hours, with unavailable doctors, or at times when a doctor is already booked. Security features include token authentication, login rate-limiting, administrator-only deletion, protection of records that have dependent appointments, and storage of secrets in environment variables. A dashboard summarises totals, upcoming appointments, status distribution and doctor workload, and an automated backend test-suite supports maintainability. The project demonstrates how a decoupled API-plus-SPA architecture can deliver a secure, maintainable solution to a practical healthcare administration problem.
>
> **Keywords:** Django REST Framework, React, MySQL, REST API, token authentication, appointment scheduling, Bootstrap.

## 10. Project report outline

1. Title page, certificate, declaration, acknowledgement
2. Abstract (section 9), table of contents, lists of figures and tables
3. **Introduction:** background, problem statement, objectives, scope
4. **Existing system and literature survey:** manual systems, commercial hospital management software, why a REST API + SPA
5. **System analysis:** feasibility, functional and non-functional requirements, user roles, hardware/software requirements
6. **System design:** architecture diagram, use-case diagram, data-flow diagrams, ER diagram, table structures, API design (endpoint table), UI wireframes, security design
7. **Implementation:** environment setup, backend modules (models, serializers, views, permissions), frontend modules (routing, auth context, API layer, pages), key code snippets, challenges
8. **Testing:** strategy, test-case table (ID, description, input, expected, actual, status - fill "actual" and "status" only from tests you ran), manual test results, screenshots
9. **Results:** screenshots of every page, validation errors, mobile view, Django Admin
10. **Conclusion and future scope:** achievements, limitations, enhancements (SMS/e-mail reminders, doctor schedules, patient portal, JWT with refresh tokens, Docker deployment)
11. References, appendices (installation guide, API reference, sample data)

## 11. Demonstration script (about 10-12 minutes)

**Before you start:** MySQL service running; Django running (`runserver`); React running (`npm run dev`); demo data loaded; one admin and one normal user created; two browser windows ready; the Postman/browser tab for the API optional.

| Time | Action | What to say |
|------|--------|-------------|
| 0:00 | Show the login page | "This is a React single-page app. It talks to a Django REST API; nothing works without logging in." |
| 0:45 | Wrong password, then correct | "Login returns a token that React sends with every request. Login is rate-limited to 10 tries a minute." |
| 1:30 | Dashboard | "The numbers come from one API call that uses database aggregation." |
| 3:00 | Doctors: search, filter availability, add one with bad data then good data | "Validation runs on the server, and Django REST Framework returns errors per field, which React shows under the inputs." |
| 5:00 | Patients: add, edit | "Age is calculated on the server from the date of birth." |
| 6:00 | Appointments: book one; then try the same doctor/time again; try a past date | "Business rules live in the serializer, so they cannot be bypassed by the frontend." |
| 8:00 | Complete one, cancel one; reuse the cancelled slot | "Cancelled appointments free the slot." |
| 8:45 | Delete a doctor with appointments | "The foreign key is PROTECT, so the API returns 409 and React shows a clear message." |
| 9:30 | Log in as the normal user | "No delete buttons - and the API itself returns 403 if someone calls delete directly." |
| 10:15 | Open `/admin/` and (optional) an API URL with the token in Postman | "Django Admin is integrated; the same API could serve a mobile app." |
| 10:45 | Resize the window | "Bootstrap makes the layout responsive." |
| 11:15 | Show test output and `.env` / `.gitignore` | "I ran the 54 backend tests on <date> with this result: <your real result>. Secrets stay in `.env`, which Git ignores." |

If something fails live, stay calm: say what you would check (browser network tab, Django terminal log, the error message in the toast).

## 12. Interview questions and answers

**Project and architecture**
1. **What does your project do?** Manages doctors, patients and appointment bookings for a hospital through a Django REST API and a React interface.
2. **Why separate backend and frontend?** The API can be reused by other clients (mobile app), each side can be developed and deployed independently, and responsibilities are clear: Django owns data and rules, React owns presentation.
3. **How do React and Django communicate?** React calls the JSON API with `fetch`; every request carries `Authorization: Token ...`. In development Vite proxies `/api` to Django, so there are no CORS problems.
4. **What is a REST API?** An interface where resources (doctors, patients, appointments) have URLs and are manipulated with HTTP methods: GET read, POST create, PUT/PATCH update, DELETE remove, with meaningful status codes.
5. **Why MySQL?** Reliable relational database with constraints and indexes; Django supports it through `mysqlclient`.

**Django REST Framework**
6. **What is a serializer?** Converts model instances to JSON and validates incoming JSON before it reaches the database.
7. **What is a ViewSet and a router?** A ViewSet groups list/create/retrieve/update/delete logic in one class; the router generates the URLs automatically.
8. **How does token authentication work here?** Login checks username/password and returns a token stored in `authtoken_token`. Later requests send it in the `Authorization` header and DRF finds the user. Logout deletes the token.
9. **How do you restrict deletion to admins?** A custom permission `StaffOnlyDelete` returns false for DELETE unless `user.is_staff`; combined with `IsAuthenticated`.
10. **How is pagination done?** `PageNumberPagination` returns `{count, next, previous, results}`; clients may request `?page_size=` up to 100.
11. **Where are the double-booking rules?** In `AppointmentSerializer.validate()`: it checks the datetime is not in the past, the doctor is available, and no non-cancelled appointment exists for the same doctor/date/time (excluding the appointment being edited).
12. **Why do you return 409 when deleting a doctor?** The foreign key is `PROTECT`; Django raises `ProtectedError`, which I catch and translate into a 409 Conflict with a clear message.
13. **What does `select_related` do?** Loads related doctor and patient in the same SQL query, avoiding one extra query per row (N+1 problem).
14. **How are search and filters implemented?** DRF `SearchFilter` for `?search=`, and custom `get_queryset` code for `status`, `doctor`, `date`; invalid values are ignored instead of raising errors.
15. **What is throttling?** Limiting how often a client can call an endpoint; I use a scoped throttle to limit login attempts.

**React**
16. **How is the React app structured?** Pages (one per screen), reusable components (modals, pagination, layout), hooks (`usePaginated`, `useDebounce`), an auth context, and an API module.
17. **What is Context and why use it for auth?** It shares data (current user, login/logout functions) with all components without passing props through every level.
18. **What is a protected route?** A wrapper that redirects anonymous users to `/login`. It is a convenience; the real protection is the API returning 401.
19. **What do `useState` and `useEffect` do?** `useState` stores component data; `useEffect` runs side effects such as fetching data when dependencies change.
20. **Why debounce the search box?** To avoid sending a request on every keystroke; the request is sent 350 ms after typing stops.
21. **How do validation errors reach the form?** The API returns `{field: [messages]}` with status 400; `FormModal` stores them and renders each under its field.
22. **What are the limitations of storing the token in localStorage?** Scripts injected via XSS could read it; HTTP-only cookies are safer. React's escaping reduces the risk.

**Security, testing, process**
23. **How do you protect secrets?** Environment variables loaded from `.env`, which `.gitignore` excludes; `.env.example` documents what is needed.
24. **How do you prevent SQL injection?** The ORM uses parameterised queries; no raw SQL is written.
25. **How did you test the backend?** With DRF's `APITestCase` (login, CRUD, validation, booking rules, permissions, filters, dashboard). *State what you actually ran and the result.*
26. **What is the difference between PUT and PATCH?** PUT replaces the whole resource, PATCH changes only the fields sent. The status buttons use PATCH.
27. **What would you improve?** JWT with refresh tokens or HTTP-only cookies, doctor schedules and slot lengths, reminders, audit log, React tests, Docker deployment.
28. **What was the hardest part?** *(Give your honest answer, e.g. understanding serializers, validating booking rules, or configuring MySQL.)*

**Be ready to show:** `AppointmentSerializer.validate`, `AppointmentViewSet.get_queryset`, `api.js`, `FormModal.jsx` and one test.

## 13. Limitations and future work

See README section 9. Highest-value next steps: run and fix anything the first real test run reveals, add React tests (Vitest + Testing Library), switch to HTTP-only cookie or short-lived JWT authentication, add doctor schedules with fixed slot lengths, and add a CI pipeline that runs the tests on every push.
