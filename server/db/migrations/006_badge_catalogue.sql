-- Badge catalogue: donations, gifting, server-booster claims, sale-event badges,
-- the 1M milestone, and descriptions shown on the dashboard's "All badges" list.

-- Gifts: who receives what a purchase grants (NULL = the buyer).
ALTER TABLE purchases ADD COLUMN recipient_id uuid REFERENCES users(id);
CREATE INDEX purchases_recipient ON purchases (recipient_id) WHERE recipient_id IS NOT NULL;

-- Products that take a buyer-chosen amount (price_cents is then the minimum).
ALTER TABLE products ADD COLUMN custom_amount boolean NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN giftable boolean NOT NULL DEFAULT false;

INSERT INTO products (key, name, description, price_cents, billing, enabled, grants, custom_amount) VALUES
  ('donation', 'Donation', 'Support LORN.LOL. Any amount from $10 earns the Donor badge.', 1000, 'one_time', true, '{"badge":"donor"}', true),
  ('image_host', 'Image Host', 'Image hosting with your own domain. Not available yet.', 499, 'one_time', false, '{"badge":"image_host"}', false)
ON CONFLICT (key) DO NOTHING;

UPDATE products SET giftable = true WHERE key IN ('premium', 'verified', 'badge_pack');

-- 1,000,000 registrations, once.
INSERT INTO platform_milestones (key, name, kind, threshold, badge_key)
VALUES ('1m', '1,000,000 registrations', 'total_reached', 1000000, 'the_million')
ON CONFLICT DO NOTHING;

-- Sale badges: earned by buying anything during the event window. Only applied
-- to events that haven't started, so nothing already running changes.
UPDATE badge_events
SET eligibility = eligibility || '{"requirePurchaseDuringEvent": true}'::jsonb,
    description = 'Exclusive badge from the ' || name || ' sale: buy anything on LORN.LOL while it runs.'
WHERE key IN ('christmas_2026', 'easter_2027') AND starts_at > now();

-- Descriptions for badges seeded before descriptions existed. Admin edits are kept.
UPDATE badges b SET description = d.description
FROM (VALUES
  ('owner', 'The founder of LORN.LOL.'),
  ('verified', 'Purchase or be a known content creator.'),
  ('staff', 'Be a part of the LORN.LOL staff team.'),
  ('developer', 'Builds LORN.LOL.'),
  ('premium', 'Purchase the Premium package.'),
  ('og', 'Be one of the first 150 people on LORN.LOL.'),
  ('early_supporter', 'Supported LORN.LOL early on.'),
  ('milestone_1k', 'Here when LORN.LOL reached 1,000 users.'),
  ('bug_hunter', 'Report a bug to the LORN.LOL team.'),
  ('helper', 'Be active and help users in the community.'),
  ('christmas_2026', 'Exclusive badge from the Christmas 2026 sale.'),
  ('easter_2027', 'Exclusive badge from the Easter 2027 sale.'),
  ('summer_2027', 'Exclusive badge from Summer 2027.')
) AS d(key, description)
WHERE b.key = d.key AND b.description = '';
