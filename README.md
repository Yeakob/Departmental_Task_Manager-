# DWMT — Departmental Work Management & Task Tracking System

A full-stack MERN application for running a university academic department: task assignment and approval, committees, meetings and minutes, projects with timelines, a shared document repository, a departmental calendar, real-time notifications and effort-weighted reports. It replaces scattered Excel trackers, paper assignments and WhatsApp instructions with one system.

Developed by **Yeakob Ali**, Lecturer, Dept. of CSE, BAIUST — yeakob.cse@baiust.ac.bd

---

## Contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Quick start (development)](#quick-start-development)
4. [Demo accounts](#demo-accounts)
5. [Configuration](#configuration)
6. [Project structure](#project-structure)
7. [Roles and permissions](#roles-and-permissions)
8. [API documentation](#api-documentation)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Backups](#backups)
12. [Design notes](#design-notes)
13. [Known limitations](#known-limitations)

---

## Features

| Area | What's included |
|---|---|
| **Tasks** | Sequential IDs per department (`CSE-0042`), 15 standard + custom categories, 4 priorities, 10-state workflow with enforced transitions, primary + supporting assignees, individual responsibilities, subtasks, dependencies, checklists (auto-progress), estimated/actual hours, tags, custom fields, watchers, personal tasks, templates, duplication, bulk create/assign/status, recycle bin with restore |
| **Assignment** | Assign to people or committees, reassign/add people, delegate (with permission), full assignment history, automatic notifications |
| **Approval** | Submit with deliverable files → approve / request revision / reject with comments → resubmit; every round and its files kept |
| **Extensions** | Assignee requests a new deadline with a reason; owner approves or declines |
| **Kanban** | Drag-and-drop (mouse, touch, keyboard), invalid transitions blocked with explanation, optimistic updates with rollback, live sync across users, project-level boards |
| **Dashboard** | Plain-language summary of what needs you, six stat cards, weekly/monthly charts, status/priority/category breakdowns, faculty workload vs capacity, on-time trend, task lists, activity feed, meetings, announcements; filters by date, faculty, committee, category, priority, status; department vs personal scope |
| **Projects** | Manager, team, dates, optional budget, milestones, effort-weighted progress, task list, Kanban, Gantt-style timeline, documents, archive |
| **Committees** | Coordinator, members with roles, responsibilities, schedule, assigned tasks, meetings, documents/reports, completion stats |
| **Meetings** | Agenda, invitations, RSVP, attendance, rich-text minutes or uploaded minutes file, decisions with owners and deadlines, one-click conversion of decisions into tasks, searchable archive, 1-hour reminders |
| **Calendar** | Day / week / month / year / agenda views; task deadlines, meetings, exams, seminars, workshops, events, milestones, semester dates, holidays; colour-coded filters; drag-and-drop rescheduling; ICS export |
| **Documents** | 10 categories, PDF/Office/image/ZIP uploads (type + size validated), private storage (never served statically), department-wide or restricted visibility by person or role, version history, inline preview for PDF/images, links to tasks/projects/committees/meetings |
| **Notifications** | Socket.IO real-time + email (SMTP, optional), unread counter, mark read/unread/all, per-type muting, deadline reminders at configurable offsets (default 7d/3d/1d/1h) de-duplicated, overdue alerts, optional 8:00 daily summary |
| **Reports** | Department, faculty and personal reports for any period; effort-weighted metrics (not raw counts), on-time and reliability rates, workload vs capacity, committee and project performance, category stats, overdue analysis, approval turnaround; PDF, Excel (multi-sheet), CSV and print |
| **Search** | Global search (Ctrl/⌘ + K) across tasks, IDs, projects, committees, meetings, documents and people; recent searches; saved task filters shareable by URL |
| **Admin** | Users (multi-role), granular permission matrix and custom roles, departments with reminder schedules, categories, academic sessions, recurring tasks (daily → annually, semester-wise), audit trail, recycle bin, JSON data export |
| **UX** | Light / dark / system themes, responsive down to phones, collapsible sidebar, skeletons, empty and error states, toasts, accessible table views for every chart, PWA installable |

## Tech stack

**Client:** React 18 (Vite), Redux Toolkit + RTK Query, React Router, Tailwind CSS with shadcn-style components on Radix UI, Lucide icons, Recharts, FullCalendar, TipTap, dnd-kit, React Hook Form + Zod, Socket.IO client, SheetJS + jsPDF for exports, vite-plugin-pwa.

**Server:** Node.js 20+ / Express 4, MongoDB 6+ with Mongoose 8, JWT access tokens + rotating HTTP-only refresh cookies, Zod validation, Socket.IO, Multer, node-cron, Nodemailer, Pino logging, Helmet, rate limiting, mongo-sanitize, HPP, Swagger UI.

## Quick start (development)

**Prerequisites:** Node.js 20 or newer, MongoDB 6 or newer (local or Atlas). A replica set is recommended so multi-document writes run in transactions; a standalone `mongod` also works (the code falls back automatically).

```bash
# 1. Install everything
npm run install:all

# 2. Configure the server
cp server/.env.example server/.env
#    then edit server/.env: MONGO_URI, and replace both JWT secrets with long random strings, e.g.
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Create roles, permissions, categories and the Super Admin
npm run seed
#    or, with a realistic demo CSE department (10 users, committees, projects, ~30 tasks, meetings):
npm --prefix server run seed:demo
#    to wipe and rebuild the demo (development only):
npm --prefix server run seed -- --reset --demo

# 4. Run API (port 5000) and client (port 5173) together
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api`, `/uploads` and `/socket.io` to the API.

### Initial Super Admin

`npm run seed` creates the account in `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` (defaults `admin@dwmt.local` / `Admin@12345`). In production the account is flagged to change its password on first sign-in. Sign in as Super Admin, create your department under **Settings → Departments**, then add users under **Settings → Users** and assign the department's Chairman.

## Demo accounts

Created by `seed:demo`; all use the password `Demo@12345`. The sign-in page shows one-click buttons for these in development builds only.

| Role | Email |
|---|---|
| Super Admin | admin@dwmt.local (`Admin@12345`) |
| Chairman | chairman@dwmt.local |
| Program Coordinator | pc@dwmt.local |
| Faculty + Committee Coordinator | tanvir@dwmt.local, nusrat@dwmt.local |
| Faculty | rafiq@dwmt.local, sadia@dwmt.local, imran@dwmt.local, mitu@dwmt.local |
| Office Staff | office@dwmt.local, lab@dwmt.local |

## Configuration

All server settings live in `server/.env` (see `server/.env.example`):

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | **Required.** Long random strings, different from each other |
| `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES` | Defaults `15m` and `7d` |
| `CLIENT_URL` | Allowed CORS origin(s), comma separated; also used for links in emails |
| `COOKIE_SECURE` | `true` behind HTTPS (always on when `NODE_ENV=production`) |
| `UPLOAD_DIR`, `MAX_FILE_SIZE_MB` | File storage location and per-file limit (default 20 MB) |
| `SMTP_*`, `EMAIL_FROM` | Email delivery. If `SMTP_HOST` is empty, emails are written to the log instead |
| `SUPER_ADMIN_*` | Initial administrator created by the seed script |
| `DISABLE_JOBS` | `true` to stop reminders/recurring jobs (e.g. on a second API instance) |

Per-department settings (reminder schedule, task ID prefix) are edited in the app under **Settings → Departments**.

## Project structure

```
dwmt/
├── client/                     React app
│   └── src/
│       ├── app/                App root, session restore, site config (branding, developer credit)
│       ├── components/ui/      Design-system primitives (button, dialog, dropdown, tabs…)
│       ├── components/common/  Shared pieces (page header, states, pickers, rich text, footer…)
│       ├── features/           tasks, kanban, dashboard, projects, committees, meetings, documents, settings
│       ├── hooks/              permissions, actions, downloads, real-time socket sync
│       ├── layouts/            App shell: sidebar, top bar, global search, notification bell
│       ├── pages/              One file per route
│       ├── routes/             Route table and guards
│       ├── services/           RTK Query API slice and all endpoints
│       ├── store/              Redux store, auth and UI slices
│       ├── styles/             Theme tokens (light/dark) and base styles
│       └── utils/              CSV / Excel / PDF exporters
└── server/
    ├── scripts/                smoke-test.mjs (164 API checks), jobs-test.mjs (reminders/recurring)
    └── src/
        ├── config/             env, database, logger, constants (statuses, permissions, default roles)
        ├── controllers/        Request handlers per module
        ├── jobs/               Reminders, overdue alerts, meeting reminders, recurring tasks, daily summary
        ├── middleware/         auth/permissions, validation, uploads, errors, audit
        ├── models/             25 Mongoose schemas
        ├── routes/             Express routers (also drive the OpenAPI spec)
        ├── seed/               Seed script
        ├── services/           Task workflow, approvals, notifications, email, reports, storage
        ├── sockets/            Socket.IO auth and rooms
        ├── utils/              Errors, pagination, tokens, IDs, OpenAPI builder
        ├── validators/         Zod schemas
        ├── app.js              Express app
        └── server.js           HTTP + Socket.IO + jobs bootstrap
```

## Roles and permissions

Access is decided by **granular permissions**, not role names. A user can hold several roles; their permissions are the union. Super Admin holds the wildcard `*`.

| Role | Highlights |
|---|---|
| Super Admin | Everything, across all departments |
| Department Chairman | All department tasks, assign/approve, delete/restore, categories, projects, committees, meetings, announcements (incl. pinning), users, audit, all reports, data export |
| Program Coordinator | All department tasks, assign/approve, projects, meetings, announcements, faculty and department reports |
| Committee Coordinator | Assign tasks, manage own committees and their meetings |
| Faculty / Office Staff | Own tasks (view, acknowledge, progress, comment, submit, request extensions), personal tasks, documents, own performance report |

Custom roles can be created and every role's permissions edited under **Settings → Roles and permissions** (Super Admin). Rules enforced on the server include:

- Every query is scoped to the user's department; cross-department access returns 403.
- Users without `task:read_all` only see tasks they are on (assignee, supporter, watcher, reviewer, assigner).
- Assignees can't change the deadline, priority or other owner-controlled fields.
- Approvers can't approve their own work; only Super Admin can grant Super Admin.
- Restricted documents are visible only to listed people/roles and the uploader.

## API documentation

- Interactive docs: **http://localhost:5000/api/docs** (Swagger UI)
- OpenAPI JSON: `GET /api/v1/openapi.json`

The spec is generated from the registered Express routers, so it always matches the code. Request bodies are validated by the Zod schemas in `server/src/validators` and in each route file.

Conventions: all routes are under `/api/v1`. Responses are `{ success, data, meta? }`; list endpoints accept `page`, `limit`, `sort` (`field` or `-field`) and `q`. Validation errors return 422 with `details[]`. Authenticate with `POST /auth/login`, then send `Authorization: Bearer <accessToken>`. The refresh token is an HTTP-only cookie rotated by `POST /auth/refresh`; refresh and logout require the header `X-Requested-With: XMLHttpRequest` (CSRF protection). Reusing a rotated refresh token revokes all of that user's sessions.

## Testing

```bash
# API end-to-end test against a running server seeded with demo data
npm --prefix server run seed -- --reset --demo
npm --prefix server start          # in another terminal
npm --prefix server run test:smoke
npm --prefix server run test:jobs     # runs reminder, overdue and recurring jobs twice; confirms no duplicates
```

The smoke test signs in as several roles and exercises 164 checks: permissions, department isolation, the full approval loop with revision, extensions, comments and mentions, checklists, uploads (including rejected file types), restricted documents, private storage, Kanban moves, recycle bin, projects, committees, meetings (attendance, minutes, decision → task), announcements, notifications (each event type must reach its recipient), calendar and ICS, all reports, search, recurring tasks, data export, CSRF and OpenAPI.

The client was additionally checked in a headless browser as Chairman, Faculty and Office Staff on desktop, phone and dark mode, visiting every page and tab with no runtime errors, and the production build was checked for live updates between two users (a new assignment appears on the assignee’s board with a notification, without reloading).

## Deployment

### Option A — Docker Compose (MongoDB replica set + app on one origin)

```bash
cp server/.env.example .env        # set JWT secrets, SMTP, SUPER_ADMIN_*, CLIENT_URL=https://dwmt.your-university.edu
docker compose up -d --build
docker compose exec app npm run seed
```

The app container builds the client and serves it from the API on port 5000. Put HTTPS in front (Nginx, Caddy or your university's reverse proxy) and make sure WebSocket upgrades are forwarded for `/socket.io`.

### Option B — Node on a server (PM2 + Nginx)

```bash
npm run install:all
npm run build                                   # builds client/dist
cd server && NODE_ENV=production pm2 start src/server.js --name dwmt
```

With `NODE_ENV=production` the API serves `client/dist` and falls back to `index.html` for client routes. Example Nginx block:

```nginx
server {
  server_name dwmt.example.edu;
  client_max_body_size 25m;
  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

**Production checklist:** strong unique JWT secrets; `NODE_ENV=production`; HTTPS; `CLIENT_URL` set to the public origin; SMTP configured; MongoDB with authentication and a replica set; the `uploads` directory on persistent, backed-up storage; run background jobs on one instance only (`DISABLE_JOBS=true` elsewhere).

**File storage:** files are stored on local disk through `server/src/services/storage.service.js`. To use Cloudinary or S3, replace that module's `savePrivate`, `resolve` and `remove` functions; nothing else depends on the storage backend.

## Backups

- **Database:** `mongodump --uri="$MONGO_URI" --archive=dwmt-$(date +%F).gz --gzip` (schedule daily with cron); restore with `mongorestore --archive=… --gzip`.
- **Files:** back up `server/uploads` (or the `uploads` Docker volume) alongside the database.
- **In-app export:** Settings → Data export downloads a JSON copy of the department's records (no passwords or tokens).

## Design notes

- **Visual identity:** a "chalkboard" theme for an academic department, with blackboard green as the primary colour, chalk-white text on a dark sidebar, IBM Plex Sans throughout and Plex Mono only for task IDs. A single amber "highlighter" is reserved for deadlines and attention.
- **Deadline urgency edge:** every task row and card carries a left edge: red when overdue, solid amber within two days, pale amber within a week.
- **Charts:** the categorical palette was validated for colour-blind separation, lightness and contrast against both light and dark surfaces. Every chart has a table view.
- **Fair metrics:** reports use effort points (estimated hours, or a priority default, × priority weight) and show committee roles, project leadership and workload against capacity, so raw task counts never stand alone as a performance measure.
- **AI-ready:** the service layer (`createTask`, `decideApproval`, notifications) is the single entry point for changes, so a future AI module (task extraction from minutes, summaries, suggested deadlines) can propose changes that a human confirms through the same rules. The current build includes no AI features.

## Known limitations

- Google Calendar sync is not implemented. ICS export works with Google, Outlook and Apple Calendar, and the calendar feed endpoint is the integration point for a future sync.
- The interface is English-only (the preferences model already has a `language` field for adding Bengali).
- File preview is built in for PDF and images; Office files are downloaded.
- The Docker files are provided but were not run in the build environment. The production build (`NODE_ENV=production`, API serving the client) was tested directly with Node; PM2 and Nginx were not.

---

© DWMT. Developed by Yeakob Ali, Lecturer, Dept. of CSE, BAIUST — yeakob.cse@baiust.ac.bd
