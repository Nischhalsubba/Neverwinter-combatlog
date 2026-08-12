PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS log_sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('file', 'folder')),
  path TEXT NOT NULL,
  watch_mode TEXT NOT NULL DEFAULT 'latest_combat_log',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log_files (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES log_sources(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  modified_at TEXT,
  last_read_offset INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL CHECK (mode IN ('live', 'import')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raw_events (
  id TEXT PRIMARY KEY,
  log_file_id TEXT NOT NULL REFERENCES log_files(id) ON DELETE CASCADE,
  line_index INTEGER NOT NULL,
  byte_offset INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  timestamp_raw TEXT,
  parse_status TEXT NOT NULL CHECK (parse_status IN ('parsed', 'failed', 'pending')),
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parsed_events (
  id TEXT PRIMARY KEY,
  raw_event_id TEXT NOT NULL REFERENCES raw_events(id) ON DELETE CASCADE,
  timestamp_ms INTEGER,
  source_primary_name TEXT,
  source_primary_ref TEXT,
  source_secondary_name TEXT,
  source_secondary_ref TEXT,
  target_primary_name TEXT,
  target_primary_ref TEXT,
  target_secondary_name TEXT,
  target_secondary_ref TEXT,
  power_name TEXT,
  power_ref TEXT,
  event_type TEXT,
  original_tokens_json TEXT NOT NULL,
  flags_json TEXT NOT NULL,
  amount1 REAL,
  amount2 REAL,
  classification TEXT NOT NULL,
  confidence REAL NOT NULL,
  encounter_id TEXT REFERENCES encounters(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  ref TEXT,
  display_name TEXT NOT NULL,
  clean_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_owner_links (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  owner_entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  confidence REAL NOT NULL,
  strategy TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  boss_name TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_ms INTEGER,
  source_file_id TEXT REFERENCES log_files(id) ON DELETE SET NULL,
  outcome TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS encounter_event_links (
  encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  parsed_event_id TEXT NOT NULL REFERENCES parsed_events(id) ON DELETE CASCADE,
  relative_time_ms INTEGER,
  PRIMARY KEY (encounter_id, parsed_event_id)
);

CREATE TABLE IF NOT EXISTS encounter_members (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  encounter_id TEXT REFERENCES encounters(id) ON DELETE CASCADE,
  subject_entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  value REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parse_errors (
  id TEXT PRIMARY KEY,
  raw_event_id TEXT NOT NULL REFERENCES raw_events(id) ON DELETE CASCADE,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS widget_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_events_log_file_line
  ON raw_events(log_file_id, line_index);

CREATE INDEX IF NOT EXISTS idx_parsed_events_encounter_time
  ON parsed_events(encounter_id, timestamp_ms);

CREATE INDEX IF NOT EXISTS idx_parsed_events_classification
  ON parsed_events(classification);

CREATE INDEX IF NOT EXISTS idx_entities_ref
  ON entities(ref);

CREATE INDEX IF NOT EXISTS idx_metric_snapshots_encounter_scope_key
  ON metric_snapshots(encounter_id, scope, key);

