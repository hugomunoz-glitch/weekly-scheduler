-- ============================================================
-- Feature flags + per-user coaching toggle
-- Run this AFTER 20260801_coaching_system.sql
-- ============================================================

-- 1. Global feature flags table (admin-controlled)
CREATE TABLE IF NOT EXISTS feature_flags (
  key        text PRIMARY KEY,
  enabled    boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the coaching flag (off by default)
INSERT INTO feature_flags (key, enabled)
VALUES ('coaching_enabled', false)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read flags (app needs to check them)
DROP POLICY IF EXISTS "feature_flags_select" ON feature_flags;
CREATE POLICY "feature_flags_select" ON feature_flags
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can update flags (enforced in app + RLS)
DROP POLICY IF EXISTS "feature_flags_update" ON feature_flags;
CREATE POLICY "feature_flags_update" ON feature_flags
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Per-user coaching toggle on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coaching_enabled boolean NOT NULL DEFAULT false;
