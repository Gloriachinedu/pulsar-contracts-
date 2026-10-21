-- SPDX-License-Identifier: MIT
-- Migration: add `token` column to the `payments` table.
--
-- Required by the per-token payment breakdown analytics (BE-009).
-- The column is nullable-safe for existing rows: backfilled to 'native' so that
-- pre-existing payment records are grouped under a single native-asset bucket
-- until the indexer populates real token contract IDs.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS token TEXT NOT NULL DEFAULT 'native';

CREATE INDEX IF NOT EXISTS idx_payments_token ON payments(token);
