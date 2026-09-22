-- Apply after the base Directus schema and organization_members have been initialized.
-- Additive, rerunnable migration; intentionally does not guess historical email delivery.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS supporter_badge_visible boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS profile_entitlements (
  id uuid PRIMARY KEY,
  member uuid NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  feature varchar(64) NOT NULL,
  source varchar(32) NOT NULL,
  variant varchar(32),
  status varchar(24) NOT NULL DEFAULT 'active',
  valid_until timestamptz,
  external_reference varchar(255),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp,
  UNIQUE (member, feature, source)
);

CREATE TABLE IF NOT EXISTS supporter_payments (
  id uuid PRIMARY KEY,
  stripe_event_id varchar(255) NOT NULL UNIQUE,
  stripe_object_id varchar(255) NOT NULL,
  stripe_customer_id varchar(255),
  "user" uuid REFERENCES directus_users(id) ON DELETE SET NULL,
  member uuid REFERENCES organization_members(id) ON DELETE SET NULL,
  frequency varchar(16) NOT NULL,
  tier varchar(32) NOT NULL,
  amount integer,
  quantity integer NOT NULL DEFAULT 1,
  currency varchar(3),
  status varchar(24) NOT NULL,
  livemode boolean NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp
);
ALTER TABLE supporter_payments ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(255);
ALTER TABLE supporter_payments ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE supporter_payments ADD COLUMN IF NOT EXISTS notification_key varchar(512);
ALTER TABLE supporter_payments ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
ALTER TABLE supporter_payments ADD COLUMN IF NOT EXISTS email_id varchar(255);
ALTER TABLE supporter_payments ADD COLUMN IF NOT EXISTS stripe_created bigint;
ALTER TABLE supporter_payments ADD COLUMN IF NOT EXISTS event_type varchar(80);
ALTER TABLE supporter_payments ADD COLUMN IF NOT EXISTS external_reference varchar(255);
CREATE INDEX IF NOT EXISTS supporter_payments_external_reference_index ON supporter_payments(external_reference);
CREATE INDEX IF NOT EXISTS supporter_payments_notification_key_index ON supporter_payments(notification_key);
CREATE INDEX IF NOT EXISTS supporter_payments_stripe_customer_id_index ON supporter_payments(stripe_customer_id);
CREATE INDEX IF NOT EXISTS supporter_payments_user_index ON supporter_payments("user");
CREATE INDEX IF NOT EXISTS supporter_payments_member_index ON supporter_payments(member);
CREATE INDEX IF NOT EXISTS supporter_payments_stripe_object_id_index ON supporter_payments(stripe_object_id);
CREATE INDEX IF NOT EXISTS profile_entitlements_member_index ON profile_entitlements(member);
CREATE INDEX IF NOT EXISTS profile_entitlements_feature_index ON profile_entitlements(feature);
CREATE INDEX IF NOT EXISTS profile_entitlements_source_index ON profile_entitlements(source);
CREATE INDEX IF NOT EXISTS profile_entitlements_variant_index ON profile_entitlements(variant);
CREATE INDEX IF NOT EXISTS profile_entitlements_status_index ON profile_entitlements(status);
CREATE INDEX IF NOT EXISTS profile_entitlements_valid_until_index ON profile_entitlements(valid_until);
