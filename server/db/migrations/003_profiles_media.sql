-- Profiles (draft / published / versions) and the media library.

CREATE TABLE profiles (
  user_id              uuid PRIMARY KEY REFERENCES users(id),
  draft                jsonb NOT NULL,
  draft_rev            int NOT NULL DEFAULT 1,          -- optimistic concurrency for autosave
  draft_updated_at     timestamptz NOT NULL DEFAULT now(),
  published_version_id bigint,
  published_at         timestamptz,
  is_published         boolean NOT NULL DEFAULT false,
  moderation_hidden    boolean NOT NULL DEFAULT false,
  moderation_reason    text,
  view_count           bigint NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile_versions (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id),
  version    int NOT NULL,
  config     jsonb NOT NULL,
  source     text NOT NULL CHECK (source IN ('publish','rollback','template')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);
ALTER TABLE profiles ADD CONSTRAINT profiles_published_fk FOREIGN KEY (published_version_id) REFERENCES profile_versions(id);

-- ------------------------------------------------------------------ media
CREATE TABLE asset_folders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),          -- null = platform-owned (badge art)
  folder_id    uuid REFERENCES asset_folders(id) ON DELETE SET NULL,
  purpose      text NOT NULL DEFAULT 'user' CHECK (purpose IN ('user','badge','system','evidence')),
  kind         text NOT NULL CHECK (kind IN ('image','video','audio','font','cursor','icon')),
  name         text NOT NULL,
  mime         text NOT NULL,
  size_bytes   bigint NOT NULL CHECK (size_bytes >= 0),
  storage_key  text NOT NULL UNIQUE,
  thumb_key    text,
  width        int, height int, duration_ms int,
  metadata     jsonb NOT NULL DEFAULT '{}',
  sha256       text NOT NULL,
  status       text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','deleted')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);
CREATE INDEX assets_user ON assets (user_id, created_at DESC) WHERE status = 'ready';
CREATE INDEX assets_deleted ON assets (deleted_at) WHERE status = 'deleted';

CREATE TABLE upload_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id),
  purpose         text NOT NULL DEFAULT 'user',
  token_hash      bytea NOT NULL UNIQUE,
  filename        text NOT NULL,
  declared_mime   text NOT NULL,
  declared_size   bigint NOT NULL,
  kind            text NOT NULL,
  folder_id       uuid,
  replace_asset_id uuid REFERENCES assets(id),
  storage_key     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  completed_at    timestamptz,
  asset_id        uuid REFERENCES assets(id)
);

-- ------------------------------------------------------------------ integrations
CREATE TABLE integration_cache (
  key        text PRIMARY KEY,
  status     text NOT NULL,             -- ok | error | not_configured
  data       jsonb,
  error      text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
