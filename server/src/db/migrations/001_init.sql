CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS orgs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sourced_id    TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('district', 'school')),
  parent_org_id UUID REFERENCES orgs(id),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS terms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sourced_id  TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  org_id      UUID NOT NULL REFERENCES orgs(id),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sourced_id  TEXT UNIQUE NOT NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  org_id      UUID NOT NULL REFERENCES orgs(id),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS classes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sourced_id  TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  org_id      UUID NOT NULL REFERENCES orgs(id),
  term_id     UUID NOT NULL REFERENCES terms(id),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sourced_id  TEXT UNIQUE NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id),
  class_id    UUID NOT NULL REFERENCES classes(id),
  role        TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor           TEXT NOT NULL DEFAULT 'district_admin',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'previewed', 'applying', 'applied', 'rolled_back', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at      TIMESTAMPTZ,
  rolled_back_at  TIMESTAMPTZ,
  stats           JSONB,
  error_details   JSONB
);

CREATE TABLE IF NOT EXISTS sync_run_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id     UUID NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('org', 'user', 'class', 'enrollment', 'term')),
  sourced_id      TEXT NOT NULL,
  change_type     TEXT NOT NULL CHECK (change_type IN ('add', 'update', 'remove', 'conflict')),
  conflict_type   TEXT CHECK (conflict_type IN ('duplicate_email', 'missing_org', 'inactive_enrollment', 'term_mismatch')),
  incoming_data   JSONB NOT NULL,
  current_data    JSONB,
  resolution      TEXT CHECK (resolution IN ('skip', 'override', 'map')),
  resolution_meta JSONB,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'applied', 'skipped'))
);

CREATE TABLE IF NOT EXISTS sync_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id   UUID NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  snapshot_data JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_run_items_run_id ON sync_run_items(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_sync_run_items_change_type ON sync_run_items(change_type);
CREATE INDEX IF NOT EXISTS idx_sync_snapshots_run_id ON sync_snapshots(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_users_sourced_id ON users(sourced_id);
CREATE INDEX IF NOT EXISTS idx_classes_sourced_id ON classes(sourced_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_sourced_id ON enrollments(sourced_id);wh