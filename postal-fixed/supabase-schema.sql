-- ============================================
-- POSTAL — Supabase Database Schema
-- Run this in: Supabase → SQL Editor → New Query
-- ============================================

-- 1. Licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key     TEXT UNIQUE NOT NULL,
  payment_id      TEXT,
  order_id        TEXT,
  plan            TEXT NOT NULL CHECK (plan IN ('monthly', 'lifetime')),
  email           TEXT,
  amount          INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  device_count    INTEGER DEFAULT 0,
  last_used       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  bonus_days      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. OTPs table
CREATE TABLE IF NOT EXISTS otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  otp_hash    TEXT NOT NULL,
  verified    BOOLEAN DEFAULT false,
  ip_address  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Burn Notes table
CREATE TABLE IF NOT EXISTS burn_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id           TEXT UNIQUE NOT NULL,
  encrypted_content TEXT NOT NULL,
  iv                TEXT NOT NULL,
  auth_tag          TEXT NOT NULL,
  note_key          TEXT NOT NULL,
  password_hash     TEXT,
  max_reads         INTEGER DEFAULT 1,
  reads             INTEGER DEFAULT 0,
  expires_at        TIMESTAMPTZ NOT NULL,
  last_read_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  referrer_email  TEXT NOT NULL,
  uses            INTEGER DEFAULT 0,
  max_uses        INTEGER DEFAULT 10,
  active          BOOLEAN DEFAULT true,
  updated_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Referral Uses table
CREATE TABLE IF NOT EXISTS referral_uses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id  UUID REFERENCES referrals(id),
  email        TEXT NOT NULL,
  used_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Row Level Security (RLS) — Recommended
-- ============================================

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE burn_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_uses ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by API functions)
CREATE POLICY "Service role full access - licenses" ON licenses
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access - otps" ON otps
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access - burn_notes" ON burn_notes
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access - referrals" ON referrals
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access - referral_uses" ON referral_uses
  USING (auth.role() = 'service_role');

-- Allow anon reads/writes for API endpoints that use ANON key
-- (admin-stats, create-note, read-note use SERVICE key — those are fine)
-- These policies allow the REST API calls in send-otp, verify-otp, verify-license

CREATE POLICY "Anon can insert otps" ON otps FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Anon can read own otps" ON otps FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anon can update own otps" ON otps FOR UPDATE
  TO anon USING (true);

CREATE POLICY "Anon can read licenses" ON licenses FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anon can insert licenses" ON licenses FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Anon can update licenses" ON licenses FOR UPDATE
  TO anon USING (true);

CREATE POLICY "Anon can read referrals" ON referrals FOR SELECT
  TO anon USING (true);

-- ============================================
-- Useful indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_burn_notes_note_id ON burn_notes(note_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals(referrer_email);
