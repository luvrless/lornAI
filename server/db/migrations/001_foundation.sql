-- LORN.LOL Phase 1: identity, sessions, authorization, audit, platform config.

CREATE EXTENSION IF NOT EXISTS citext;

-- ------------------------------------------------------------------ UIDs
-- Gapless, never-reused UID counter. Incremented inside the registration
-- transaction (row lock), so a rolled-back signup does not burn a UID and
-- registration order is exactly UID order.
CREATE TABLE uid_counter (
  id      boolean PRIMARY KEY DEFAULT true CHECK (id),
  last    bigint NOT NULL DEFAULT 0
);
INSERT INTO uid_counter DEFAULT VALUES;

-- ------------------------------------------------------------------ users
CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid              bigint NOT NULL UNIQUE CHECK (uid > 0),
  username         text NOT NULL CHECK (char_length(username) BETWEEN 1 AND 12),
  username_lc      text NOT NULL GENERATED ALWAYS AS (lower(username)) STORED,
  email            citext,
  email_verified_at timestamptz,
  password_hash    text,
  display_name     text CHECK (char_length(display_name) <= 32),
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  locked_until     timestamptz,           -- automatic lock after failed logins
  failed_logins    int NOT NULL DEFAULT 0,
  totp_secret_enc  bytea,                 -- AES-GCM encrypted, null = 2FA off
  totp_enabled_at  timestamptz,
  tos_accepted_at  timestamptz NOT NULL,
  tos_version      text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_login_at    timestamptz,
  deleted_at       timestamptz,
  CHECK (username ~ '^[A-Za-z0-9_.]{1,12}$'),
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
);
-- Usernames and emails are unique among live accounts only; the UID stays
-- unique forever because the row is never physically removed.
CREATE UNIQUE INDEX users_username_live ON users (username_lc) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_email_live ON users (email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX users_created_at ON users (created_at);

CREATE TABLE reserved_usernames (
  username_lc text PRIMARY KEY,
  reason      text NOT NULL DEFAULT 'platform'
);
INSERT INTO reserved_usernames (username_lc) VALUES
  ('admin'),('administrator'),('root'),('lorn'),('lornlol'),('lorn.lol'),('staff'),('support'),
  ('help'),('mod'),('moderator'),('owner'),('official'),('system'),('api'),('www'),('mail'),
  ('dashboard'),('login'),('logout'),('register'),('signup'),('settings'),('account'),('billing'),
  ('premium'),('verify'),('verified'),('security'),('abuse'),('report'),('legal'),('terms'),
  ('privacy'),('tos'),('status'),('docs'),('blog'),('about'),('explore'),('templates'),
  ('static'),('assets'),('cdn'),('media'),('upload'),('uploads'),('auth'),('oauth'),
  ('discord'),('null'),('undefined'),('me'),('team'),('dev'),('developer'),('bot');

CREATE TABLE username_history (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  old_username text,
  new_username text NOT NULL,
  changed_by  uuid REFERENCES users(id),     -- null = self
  reason      text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX username_history_user ON username_history (user_id, changed_at DESC);

-- ------------------------------------------------------------------ OAuth
CREATE TABLE oauth_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  provider          text NOT NULL CHECK (provider IN ('discord','google')),
  provider_user_id  text NOT NULL,
  provider_username text,
  provider_avatar   text,
  email             text,
  access_token_enc  bytea,
  refresh_token_enc bytea,
  token_expires_at  timestamptz,
  scopes            text[],
  linked_at         timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id),        -- no duplicate Discord IDs
  UNIQUE (user_id, provider)
);
CREATE INDEX oauth_accounts_user ON oauth_accounts (user_id);

CREATE TABLE oauth_states (
  state_hash   bytea PRIMARY KEY,
  provider     text NOT NULL,
  intent       text NOT NULL CHECK (intent IN ('login','link','admin')),
  user_id      uuid REFERENCES users(id),     -- set for link/admin
  code_verifier text NOT NULL,                 -- PKCE
  redirect_to  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

-- Pending sign-up after OAuth for an identity with no account yet.
CREATE TABLE oauth_signups (
  token_hash        bytea PRIMARY KEY,
  provider          text NOT NULL,
  provider_user_id  text NOT NULL,
  provider_username text,
  provider_avatar   text,
  email             text,
  email_verified    boolean NOT NULL DEFAULT false,
  expires_at        timestamptz NOT NULL
);

-- ------------------------------------------------------------------ sessions
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    bytea NOT NULL UNIQUE,
  user_id       uuid NOT NULL REFERENCES users(id),
  auth_method   text NOT NULL,                 -- password | discord | google
  mfa_pending   boolean NOT NULL DEFAULT false,
  ip            inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  revoked_reason text
);
CREATE INDEX sessions_user ON sessions (user_id) WHERE revoked_at IS NULL;

-- Administrative elevation: proven by a fresh Discord OAuth round-trip.
CREATE TABLE admin_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES sessions(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  discord_id   text NOT NULL,
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);
CREATE INDEX admin_sessions_session ON admin_sessions (session_id) WHERE revoked_at IS NULL;

-- ------------------------------------------------------------------ tokens
CREATE TABLE auth_tokens (
  token_hash  bytea PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  purpose     text NOT NULL CHECK (purpose IN ('verify_email','reset_password','change_email')),
  data        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_by  uuid REFERENCES users(id)          -- admin-initiated recovery
);
CREATE INDEX auth_tokens_user ON auth_tokens (user_id, purpose);

CREATE TABLE recovery_codes (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id),
  code_hash  bytea NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code_hash)
);

-- ------------------------------------------------------------------ security log
CREATE TABLE login_history (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id),
  identifier  text,
  method      text NOT NULL,
  success     boolean NOT NULL,
  failure_reason text,
  suspicious  boolean NOT NULL DEFAULT false,
  ip          inet,
  user_agent  text,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_history_user ON login_history (user_id, at DESC);
CREATE INDEX login_history_ip ON login_history (ip, at DESC);

CREATE TABLE security_events (
  id        bigserial PRIMARY KEY,
  user_id   uuid REFERENCES users(id),
  kind      text NOT NULL,
  severity  text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  data      jsonb NOT NULL DEFAULT '{}',
  ip        inet,
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_events_user ON security_events (user_id, at DESC);
CREATE INDEX security_events_at ON security_events (at DESC);

-- ------------------------------------------------------------------ moderation (accounts)
CREATE TABLE account_locks (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  reason      text NOT NULL,
  locked_by   uuid REFERENCES users(id),
  locked_at   timestamptz NOT NULL DEFAULT now(),
  unlocked_at timestamptz,
  unlocked_by uuid REFERENCES users(id)
);
CREATE UNIQUE INDEX account_locks_active ON account_locks (user_id) WHERE unlocked_at IS NULL;

CREATE TABLE account_bans (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  reason      text NOT NULL,
  banned_by   uuid REFERENCES users(id),
  banned_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,                        -- null = permanent
  lifted_at   timestamptz,
  lifted_by   uuid REFERENCES users(id),
  lift_reason text
);
CREATE INDEX account_bans_user ON account_bans (user_id, banned_at DESC);
CREATE UNIQUE INDEX account_bans_active ON account_bans (user_id) WHERE lifted_at IS NULL;

-- ------------------------------------------------------------------ staff & permissions
CREATE TABLE permissions (
  key         text PRIMARY KEY,
  category    text NOT NULL,
  description text NOT NULL,
  owner_only  boolean NOT NULL DEFAULT false   -- can never be granted to non-owners
);

CREATE TABLE role_permissions (
  role        text NOT NULL CHECK (role IN ('ADMIN','STAFF')),
  permission  text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission)
);

-- Keyed by immutable Discord ID so staff can be authorized before they
-- register; user link is resolved through oauth_accounts at request time.
CREATE TABLE staff_authorizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id    text NOT NULL UNIQUE CHECK (discord_id ~ '^[0-9]{17,20}$'),
  role          text NOT NULL CHECK (role IN ('ADMIN','STAFF')),
  active        boolean NOT NULL DEFAULT true,
  note          text,
  added_by      uuid REFERENCES users(id),
  added_at      timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz
);

CREATE TABLE staff_permission_overrides (
  staff_id    uuid NOT NULL REFERENCES staff_authorizations(id) ON DELETE CASCADE,
  permission  text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted     boolean NOT NULL,
  set_by      uuid REFERENCES users(id),
  set_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, permission)
);

-- Monotonic counter bumped on every authorization change; permission caches
-- compare against it so revocation takes effect on the next request.
CREATE TABLE authz_epoch (
  id    boolean PRIMARY KEY DEFAULT true CHECK (id),
  epoch bigint NOT NULL DEFAULT 0
);
INSERT INTO authz_epoch DEFAULT VALUES;

CREATE FUNCTION bump_authz_epoch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE authz_epoch SET epoch = epoch + 1;
  RETURN NULL;
END $$;
CREATE TRIGGER staff_epoch AFTER INSERT OR UPDATE OR DELETE ON staff_authorizations FOR EACH STATEMENT EXECUTE FUNCTION bump_authz_epoch();
CREATE TRIGGER override_epoch AFTER INSERT OR UPDATE OR DELETE ON staff_permission_overrides FOR EACH STATEMENT EXECUTE FUNCTION bump_authz_epoch();
CREATE TRIGGER rolep_epoch AFTER INSERT OR UPDATE OR DELETE ON role_permissions FOR EACH STATEMENT EXECUTE FUNCTION bump_authz_epoch();
CREATE TRIGGER oauth_epoch AFTER INSERT OR UPDATE OR DELETE ON oauth_accounts FOR EACH STATEMENT EXECUTE FUNCTION bump_authz_epoch();

-- ------------------------------------------------------------------ audit log
CREATE TABLE admin_audit_log (
  id            bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id),
  actor_uid     bigint,
  actor_discord_id text,
  actor_role    text,
  action        text NOT NULL,
  target_user_id uuid,
  target_uid    bigint,
  target_username text,
  target_type   text,
  target_id     text,
  previous_state jsonb,
  new_state     jsonb,
  reason        text,
  ip            inet,
  user_agent    text,
  request_id    text,
  at            timestamptz NOT NULL DEFAULT clock_timestamp(),
  prev_hash     bytea,
  hash          bytea NOT NULL
);
CREATE INDEX audit_at ON admin_audit_log (at DESC);
CREATE INDEX audit_actor ON admin_audit_log (actor_user_id, at DESC);
CREATE INDEX audit_target ON admin_audit_log (target_user_id, at DESC);
CREATE INDEX audit_action ON admin_audit_log (action, at DESC);

-- Tamper-evident hash chain, serialized with an advisory lock.
CREATE FUNCTION audit_chain() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prev bytea;
BEGIN
  PERFORM pg_advisory_xact_lock(4242424242);
  SELECT hash INTO prev FROM admin_audit_log ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := prev;
  NEW.hash := sha256(convert_to(
    coalesce(encode(prev,'hex'),'') || '|' || NEW.action || '|' || coalesce(NEW.actor_user_id::text,'') || '|' ||
    coalesce(NEW.target_type,'') || '|' || coalesce(NEW.target_id,'') || '|' || coalesce(NEW.target_user_id::text,'') || '|' ||
    coalesce(NEW.previous_state::text,'') || '|' || coalesce(NEW.new_state::text,'') || '|' ||
    coalesce(NEW.reason,'') || '|' || NEW.at::text, 'UTF8'));
  RETURN NEW;
END $$;
CREATE TRIGGER audit_chain BEFORE INSERT ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION audit_chain();

CREATE FUNCTION audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION audit_immutable();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON admin_audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_immutable();

-- ------------------------------------------------------------------ platform
CREATE TABLE platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  protected   boolean NOT NULL DEFAULT false,   -- owner-only
  updated_by  uuid REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feature_flags (
  key              text PRIMARY KEY,
  description      text NOT NULL,
  enabled          boolean NOT NULL DEFAULT false,
  rollout_percent  int NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
  staff_only       boolean NOT NULL DEFAULT false,
  updated_by       uuid REFERENCES users(id),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  level       text NOT NULL DEFAULT 'info' CHECK (level IN ('info','success','warning','critical')),
  published   boolean NOT NULL DEFAULT false,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id),
  kind       text NOT NULL,
  title      text NOT NULL,
  body       text,
  data       jsonb NOT NULL DEFAULT '{}',
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications (user_id, created_at DESC);

CREATE TABLE notification_prefs (
  user_id         uuid PRIMARY KEY REFERENCES users(id),
  email_security  boolean NOT NULL DEFAULT true,   -- cannot be disabled in UI for critical events
  email_product   boolean NOT NULL DEFAULT false,
  inapp_all       boolean NOT NULL DEFAULT true
);

-- ------------------------------------------------------------------ email outbox
CREATE TABLE email_outbox (
  id          bigserial PRIMARY KEY,
  to_address  text NOT NULL,
  subject     text NOT NULL,
  text_body   text NOT NULL,
  html_body   text,
  template    text NOT NULL,
  user_id     uuid REFERENCES users(id),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','not_configured')),
  attempts    int NOT NULL DEFAULT 0,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);
CREATE INDEX email_outbox_pending ON email_outbox (created_at) WHERE status = 'pending';

-- ------------------------------------------------------------------ jobs
CREATE TABLE jobs (
  id              bigserial PRIMARY KEY,
  kind            text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  idempotency_key text UNIQUE,
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','dead')),
  run_at          timestamptz NOT NULL DEFAULT now(),
  attempts        int NOT NULL DEFAULT 0,
  max_attempts    int NOT NULL DEFAULT 5,
  locked_at       timestamptz,
  locked_by       text,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
CREATE INDEX jobs_ready ON jobs (run_at) WHERE status IN ('queued','running');

-- ------------------------------------------------------------------ rate limiting
CREATE TABLE rate_limits (
  bucket     text PRIMARY KEY,
  tokens     double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
