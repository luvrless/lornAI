-- Emailed 6-digit codes (sign-up verification, sign-in confirmation), remembered devices,
-- and a two-week inactivity limit on sessions. Authenticator-app 2FA is retired in favour of email codes.

CREATE TABLE email_codes (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id),
  purpose     text NOT NULL CHECK (purpose IN ('verify_email','login')),
  session_id  uuid,
  code_hash   bytea NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE INDEX email_codes_user ON email_codes (user_id, purpose) WHERE used_at IS NULL;

-- Which second step a half-signed-in session is waiting for.
ALTER TABLE sessions ADD COLUMN mfa_method text;

-- A browser that has already passed an email code. Sliding expiry; one row per browser.
CREATE TABLE trusted_devices (
  token_hash   bytea PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id),
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX trusted_devices_user ON trusted_devices (user_id);

INSERT INTO platform_settings (key, value, protected)
SELECT 'security.session_idle_days', '14', true
WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'security.session_idle_days');

-- Authenticator-app 2FA is gone: nobody should stay locked behind a factor they can no longer manage.
UPDATE users SET totp_enabled_at = NULL WHERE totp_enabled_at IS NOT NULL;
UPDATE sessions SET mfa_pending = false WHERE mfa_pending;
