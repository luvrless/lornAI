-- Default platform configuration. Values are editable through the admin
-- panel; protected keys are owner-only.
INSERT INTO platform_settings (key, value, protected) VALUES
  ('registration.enabled',      'true',  false),
  ('login.enabled',             'true',  false),
  ('maintenance.enabled',       'false', true),
  ('maintenance.message',       '"LORN.LOL is undergoing maintenance. Back soon."', false),
  ('username.min_length',       '1',     false),
  ('username.max_length',       '12',    false),
  ('tos.version',               '"2026-11-13"', false),
  ('security.session_days',     '30',    true),
  ('security.admin_session_hours', '12', true),
  ('security.max_failed_logins','8',     true),
  ('security.lockout_minutes',  '15',    true),
  ('security.require_email_verification_for_login', 'false', true),
  ('uploads.max_image_mb',      '10',    false),
  ('uploads.max_video_mb',      '100',   false),
  ('uploads.max_audio_mb',      '25',    false),
  ('uploads.quota_free_mb',     '500',   false),
  ('uploads.quota_premium_mb',  '5000',  false),
  ('premium.enabled',           'false', true),
  ('branding.name',             '"LORN.LOL"', false);

INSERT INTO feature_flags (key, description, enabled) VALUES
  ('signup.discord',   'Allow creating new accounts via Discord', true),
  ('signup.google',    'Allow creating new accounts via Google', true),
  ('templates.publish','Allow users to publish templates', true),
  ('custom_domains',   'Custom domain support', false);
