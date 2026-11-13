-- Analytics, monetization, moderation and support.

CREATE TABLE analytics_events (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id),   -- profile owner
  kind          text NOT NULL CHECK (kind IN ('view','click','play')),
  visitor_hash  bytea NOT NULL,                       -- daily-salted, not reversible to an IP
  link_id       text,
  page          text,
  referrer_host text,
  utm_source    text, utm_medium text, utm_campaign text,
  country       text,
  device        text, browser text, os text,
  at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_owner_kind_at ON analytics_events (user_id, kind, at);
CREATE INDEX analytics_at ON analytics_events (at);

CREATE TABLE analytics_salts (
  day  date PRIMARY KEY,
  salt bytea NOT NULL
);

-- ------------------------------------------------------------------ monetization
CREATE TABLE products (
  key           text PRIMARY KEY,
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  price_cents   int NOT NULL CHECK (price_cents >= 0),
  currency      text NOT NULL DEFAULT 'usd',
  billing       text NOT NULL CHECK (billing IN ('one_time','monthly')),
  enabled       boolean NOT NULL DEFAULT true,
  grants        jsonb NOT NULL,
  updated_by    uuid REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO products (key, name, description, price_cents, billing, grants) VALUES
  ('premium', 'Premium', 'Unlocks premium customization', 499, 'monthly', '{"entitlement":"premium"}'),
  ('badge_pack', 'Custom Badge Pack', 'Three custom badge credits', 299, 'one_time', '{"badge_credits":3}'),
  ('verified', 'Verified Badge', 'Purchased verification badge', 999, 'one_time', '{"entitlement":"verified","badge":"verified"}');

CREATE TABLE purchases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  product_key         text NOT NULL REFERENCES products(key),
  provider            text NOT NULL,
  provider_session_id text UNIQUE,
  amount_cents        int NOT NULL,
  currency            text NOT NULL,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','partially_refunded','expired')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz
);
CREATE INDEX purchases_user ON purchases (user_id, created_at DESC);

CREATE TABLE payments (
  id                  bigserial PRIMARY KEY,
  purchase_id         uuid REFERENCES purchases(id),
  provider_payment_id text NOT NULL UNIQUE,
  amount_cents        int NOT NULL,
  currency            text NOT NULL,
  status              text NOT NULL,
  at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id                 bigserial PRIMARY KEY,
  purchase_id        uuid NOT NULL REFERENCES purchases(id),
  provider_refund_id text UNIQUE,
  amount_cents       int NOT NULL,
  reason             text,
  requested_by       uuid REFERENCES users(id),
  status             text NOT NULL DEFAULT 'succeeded',
  at                 timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  product_key         text NOT NULL REFERENCES products(key),
  provider            text NOT NULL,
  provider_sub_id     text NOT NULL UNIQUE,
  status              text NOT NULL,
  current_period_end  timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entitlements (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id),
  kind         text NOT NULL CHECK (kind IN ('premium','verified')),
  source       text NOT NULL CHECK (source IN ('purchase','subscription','admin_grant')),
  purchase_id  uuid REFERENCES purchases(id),
  subscription_id uuid REFERENCES subscriptions(id),
  starts_at    timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  revoked_at   timestamptz,
  granted_by   uuid REFERENCES users(id),
  revoked_by   uuid REFERENCES users(id),
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entitlements_user ON entitlements (user_id, kind);
CREATE UNIQUE INDEX entitlements_purchase ON entitlements (purchase_id, kind) WHERE purchase_id IS NOT NULL;

CREATE TABLE webhook_events (
  provider     text NOT NULL,
  event_id     text NOT NULL,
  type         text NOT NULL,
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error        text,
  PRIMARY KEY (provider, event_id)
);

-- ------------------------------------------------------------------ moderation
CREATE TABLE reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    uuid REFERENCES users(id),
  target_type    text NOT NULL CHECK (target_type IN ('user','profile','content','custom_badge','template')),
  target_user_id uuid REFERENCES users(id),
  target_ref     text,
  category       text NOT NULL CHECK (category IN ('impersonation','harassment','inappropriate','malicious_links','copyright','spam','other')),
  description    text NOT NULL,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','resolved','rejected')),
  priority       text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to    uuid REFERENCES users(id),
  resolution     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_status ON reports (status, created_at);
CREATE INDEX reports_target ON reports (target_user_id);

CREATE TABLE report_evidence (
  id        bigserial PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES reports(id),
  asset_id  uuid REFERENCES assets(id),
  url       text,
  note      text
);

CREATE TABLE report_notes (
  id        bigserial PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES reports(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body      text NOT NULL,
  at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE moderation_actions (
  id              bigserial PRIMARY KEY,
  moderator_id    uuid NOT NULL REFERENCES users(id),
  target_user_id  uuid REFERENCES users(id),
  report_id       uuid REFERENCES reports(id),
  action          text NOT NULL,
  reason          text NOT NULL,
  previous_status text,
  new_status      text,
  data            jsonb NOT NULL DEFAULT '{}',
  at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX moderation_actions_target ON moderation_actions (target_user_id, at DESC);

CREATE TABLE warnings (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id),
  issued_by  uuid NOT NULL REFERENCES users(id),
  reason     text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);

CREATE TABLE user_notes (
  id        bigserial PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES users(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body      text NOT NULL,
  at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_flags (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id),
  flagged_by uuid NOT NULL REFERENCES users(id),
  reason     text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz,
  cleared_by uuid REFERENCES users(id)
);

-- ------------------------------------------------------------------ support
CREATE TABLE support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      bigserial UNIQUE,
  user_id     uuid NOT NULL REFERENCES users(id),
  category    text NOT NULL CHECK (category IN ('account','billing','profile','bug','report','other')),
  subject     text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','awaiting_staff','awaiting_user','escalated','closed')),
  priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);
CREATE INDEX support_tickets_status ON support_tickets (status, updated_at DESC);

CREATE TABLE ticket_messages (
  id          bigserial PRIMARY KEY,
  ticket_id   uuid NOT NULL REFERENCES support_tickets(id),
  author_id   uuid NOT NULL REFERENCES users(id),
  from_staff  boolean NOT NULL DEFAULT false,
  internal    boolean NOT NULL DEFAULT false,
  body        text NOT NULL,
  attachment_ids uuid[] NOT NULL DEFAULT '{}',
  at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (key, value, protected) VALUES
  ('payments.provider', '"none"', true),
  ('analytics.retention_days', '400', false);
