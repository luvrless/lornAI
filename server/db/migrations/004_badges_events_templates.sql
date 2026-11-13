-- Dynamic badge registry, ownership, events, milestones, templates.

CREATE TABLE badges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key            text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  description    text NOT NULL DEFAULT '',
  tooltip        text NOT NULL DEFAULT '',
  category       text NOT NULL CHECK (category IN ('verified','premium','staff','developer','founder','early_supporter','og','community','helper','event','milestone','custom','special')),
  rarity         text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','uncommon','rare','epic','legendary','mythic')),
  icon_asset_id  uuid REFERENCES assets(id),
  icon_preset    text,                     -- built-in SVG glyph name when no artwork is uploaded
  color          text NOT NULL DEFAULT '#60a5fa',
  gradient_from  text, gradient_to text,
  border_color   text,
  glow           int NOT NULL DEFAULT 0 CHECK (glow BETWEEN 0 AND 100),
  hover          text NOT NULL DEFAULT 'lift',
  display_size   int NOT NULL DEFAULT 22 CHECK (display_size BETWEEN 12 AND 64),
  sort_order     int NOT NULL DEFAULT 100,
  enabled        boolean NOT NULL DEFAULT true,
  visibility     text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','hidden')),
  availability   text NOT NULL DEFAULT 'assignable' CHECK (availability IN ('assignable','restricted','event_only','purchase_only','automatic')),
  eligibility    jsonb NOT NULL DEFAULT '{}',
  archived_at    timestamptz,
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
  user_id      uuid NOT NULL REFERENCES users(id),
  badge_id     uuid NOT NULL REFERENCES badges(id),
  method       text NOT NULL CHECK (method IN ('manual','automatic','event','purchase','milestone','admin_grant','custom')),
  source_ref   text,
  acquired_at  timestamptz NOT NULL DEFAULT now(),
  hidden       boolean NOT NULL DEFAULT false,
  sort_order   int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, badge_id)
);
CREATE INDEX user_badges_badge ON user_badges (badge_id);

CREATE TABLE badge_assignments (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id),
  recipient_uid bigint NOT NULL,
  badge_id      uuid NOT NULL REFERENCES badges(id),
  action        text NOT NULL CHECK (action IN ('assign','revoke')),
  method        text NOT NULL,
  reason        text,
  actor_user_id uuid REFERENCES users(id),
  idempotency_key text UNIQUE,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX badge_assignments_badge ON badge_assignments (badge_id, at DESC);
CREATE INDEX badge_assignments_user ON badge_assignments (user_id, at DESC);

CREATE TABLE custom_badges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  icon_asset_id uuid NOT NULL REFERENCES assets(id),
  color        text NOT NULL DEFAULT '#60a5fa',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','removed')),
  badge_id     uuid REFERENCES badges(id),     -- created on approval
  reviewed_by  uuid REFERENCES users(id),
  review_note  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz
);

CREATE TABLE badge_credits (
  user_id  uuid PRIMARY KEY REFERENCES users(id),
  balance  int NOT NULL DEFAULT 0 CHECK (balance >= 0)
);
CREATE TABLE badge_credit_ledger (
  id        bigserial PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES users(id),
  delta     int NOT NULL,
  reason    text NOT NULL,
  ref       text,
  at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, ref)
);

-- ------------------------------------------------------------------ events & milestones
CREATE TABLE badge_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 text NOT NULL UNIQUE,
  name                text NOT NULL,
  description         text NOT NULL DEFAULT '',
  badge_id            uuid REFERENCES badges(id),
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  registration_cutoff timestamptz,
  eligibility         jsonb NOT NULL DEFAULT '{}',
  enabled             boolean NOT NULL DEFAULT true,
  status              text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','running','completed','failed','disabled')),
  distributed_at      timestamptz,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE event_distributions (
  id          bigserial PRIMARY KEY,
  event_id    uuid NOT NULL REFERENCES badge_events(id),
  started_by  uuid REFERENCES users(id),
  trigger     text NOT NULL,              -- manual | schedule | retry
  status      text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  total       int NOT NULL DEFAULT 0,
  assigned    int NOT NULL DEFAULT 0,
  skipped     int NOT NULL DEFAULT 0,
  failed      int NOT NULL DEFAULT 0,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE event_recipients (
  event_id    uuid NOT NULL REFERENCES badge_events(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','assigned','already_owned','failed')),
  attempts    int NOT NULL DEFAULT 0,
  error       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE platform_milestones (
  key          text PRIMARY KEY,
  name         text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('first_n','total_reached')),
  threshold    int NOT NULL,
  badge_key    text NOT NULL,
  triggered_at timestamptz,
  recipients   int NOT NULL DEFAULT 0,
  failures     int NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------------ templates
CREATE TABLE templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         uuid NOT NULL REFERENCES users(id),
  name             text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  description      text NOT NULL DEFAULT '',
  kind             text NOT NULL CHECK (kind IN ('full','background','card','typography','animation','effects')),
  config           jsonb NOT NULL,
  preview_asset_id uuid REFERENCES assets(id),
  visibility       text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','unlisted','private')),
  tags             text[] NOT NULL DEFAULT '{}',
  uses             int NOT NULL DEFAULT 0,
  favorites        int NOT NULL DEFAULT 0,
  moderation_hidden boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX templates_public ON templates (favorites DESC, created_at DESC) WHERE visibility = 'public' AND NOT moderation_hidden;
CREATE TABLE template_favorites (
  user_id     uuid NOT NULL REFERENCES users(id),
  template_id uuid NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, template_id)
);
