# district-roster-sync

A full-stack SIS roster ingestion pipeline built as a district-scale add-on for Almaa EDU. Supports OneRoster CSV import, preview/diff, conflict resolution, sync logs, rollback, and data health monitoring.

---

## What it does

District admins upload OneRoster-style CSV files exported from their SIS (Student Information System). The app computes a diff against the current Almaa EDU database, shows a preview of all changes, lets admins resolve conflicts, then applies the sync — all with a full audit trail and rollback support.

---

## Stack

- **Frontend** — React + Vite + react-router-dom + axios
- **Backend** — Node.js + Express
- **Database** — PostgreSQL (via Docker)
- **CSV parsing** — csv-parse

---

## Prerequisites

- Node.js v18+
- Docker Desktop

---

## Setup

**1. Clone the repo**
```bash
git clone https://github.com/CodesProS/district-roster-sync.git
cd district-roster-sync
```

**2. Start the database**
```bash
docker-compose up -d
```

**3. Set up the server**
```bash
cd server
npm install
npm run migrate
npm run seed
```

**4. Start the server**
```bash
npm run dev
```
Server runs on `http://localhost:3001`

**5. Set up and start the client (new terminal)**
```bash
cd client
npm install
npm run dev
```
Client runs on `http://localhost:5173`

---

## Usage

1. Go to `http://localhost:5173`
2. Upload the sample CSVs from `server/sample-csvs/`
3. Review the diff — adds, updates, removes, conflicts
4. Resolve any conflicts (skip or override)
5. Click "Apply Sync"
6. View sync history and rollback if needed
7. Check data health at `/sync/health`

---

## Project structure

```
district-roster-sync/
├── docker-compose.yml
├── server/
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/     # SQL schema
│   │   │   ├── pool.js         # DB connection
│   │   │   ├── migrate.js      # migration runner
│   │   │   └── seed.js         # mock Almaa EDU data
│   │   ├── routes/
│   │   │   ├── sync.js         # upload, preview, resolve, apply, rollback
│   │   │   └── health.js       # data health indicators
│   │   ├── services/
│   │   │   ├── csvParser.js    # OneRoster CSV parsing
│   │   │   ├── diffEngine.js   # computes adds/updates/removes/conflicts
│   │   │   └── applySync.js    # applies diff to DB, handles rollback
│   │   └── index.js
│   └── sample-csvs/            # test CSV files
└── client/
    └── src/
        ├── pages/
        │   ├── UploadPage.jsx
        │   ├── PreviewPage.jsx
        │   ├── HistoryPage.jsx
        │   └── HealthPage.jsx
        └── App.jsx
```

---

## API

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/sync/upload` | Upload CSV bundle, compute diff |
| GET | `/api/sync/runs` | List all sync runs |
| GET | `/api/sync/:id/preview` | Get diff items for a sync run |
| POST | `/api/sync/:id/resolve` | Submit conflict resolutions |
| POST | `/api/sync/:id/apply` | Apply the sync to the DB |
| POST | `/api/sync/:id/rollback` | Roll back an applied sync |
| GET | `/api/health` | Data health indicators |

---

## Data model

**Layer 1 — Mock Almaa EDU tables:** `orgs`, `terms`, `users`, `classes`, `enrollments`

**Layer 2 — Sync tables:** `sync_runs`, `sync_run_items`, `sync_snapshots`

Each sync run creates one `sync_run` record and one `sync_run_item` per changed entity. Snapshots are taken before any update or remove so the sync can be rolled back cleanly.

---

## Sample CSV files

Located in `server/sample-csvs/`. Designed to produce a realistic diff against the seed data:

- 2 adds (new student, new class)
- 1 update (email change)
- 1 remove (enrollment deletion)
- 2 conflicts (duplicate email, missing user reference)