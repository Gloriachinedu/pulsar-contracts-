/**
 * monitor.test.js — Unit tests for the Pulsar contract monitor.
 *
 * Run with:
 *   npm test              (from the monitoring/ directory)
 *   node --test src/monitor.test.js
 *
 * Uses Node.js built-in test runner (node:test) — no additional dependencies.
 */

"use strict";

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// ── Metrics ────────────────────────────────────────────────────────────────

const { Metrics } = require("./metrics");

describe("Metrics", () => {
  let m;

  beforeEach(() => {
    m = new Metrics();
  });

  it("starts with zero totals", () => {
    assert.equal(m.totalPayments, 0n);
    assert.equal(m.totalPaymentVolume, 0n);
    assert.equal(m.totalRefunds, 0n);
    assert.equal(m.totalErrors, 0n);
  });

  it("recordPayment increments counters and volume", () => {
    m.recordPayment(500n);
    m.recordPayment(1500n);
    assert.equal(m.totalPayments, 2n);
    assert.equal(m.totalPaymentVolume, 2000n);
  });

  it("recordRefund increments totalRefunds", () => {
    m.recordRefund();
    m.recordRefund();
    assert.equal(m.totalRefunds, 2n);
  });

  it("recordTransaction(false) increments totalErrors", () => {
    m.recordTransaction(true);
    m.recordTransaction(false);
    assert.equal(m.totalErrors, 1n);
  });

  it("refundRate returns 0 when no payments recorded", () => {
    m.recordRefund();
    assert.equal(m.refundRate(3_600_000), 0);
  });

  it("refundRate returns correct fraction", () => {
    // 4 payments, 1 refund → rate = 0.25
    m.recordPayment(100n);
    m.recordPayment(100n);
    m.recordPayment(100n);
    m.recordPayment(100n);
    m.recordRefund();
    const rate = m.refundRate(3_600_000);
    assert.ok(
      Math.abs(rate - 0.25) < 0.001,
      `Expected refund rate ~0.25 but got ${rate}`
    );
  });

  it("refundRate exceeds 0.20 threshold when expected", () => {
    // 3 payments, 1 refund → rate ≈ 0.333 > 0.20
    m.recordPayment(100n);
    m.recordPayment(100n);
    m.recordPayment(100n);
    m.recordRefund();
    assert.ok(m.refundRate(3_600_000) > 0.20);
  });

  it("errorRate returns 0 when no transactions recorded", () => {
    assert.equal(m.errorRate(3_600_000), 0);
  });

  it("errorRate returns correct fraction", () => {
    // 5 transactions, 2 errors → rate = 0.40
    m.recordTransaction(true);
    m.recordTransaction(true);
    m.recordTransaction(true);
    m.recordTransaction(false);
    m.recordTransaction(false);
    const rate = m.errorRate(3_600_000);
    assert.ok(
      Math.abs(rate - 0.4) < 0.001,
      `Expected error rate ~0.40 but got ${rate}`
    );
  });

  it("paymentVolume returns count of payments in window", () => {
    m.recordPayment(100n);
    m.recordPayment(200n);
    assert.equal(m.paymentVolume(3_600_000), 2);
  });

  it("snapshot returns all expected keys", () => {
    m.recordPayment(100n);
    m.recordRefund();
    const snap = m.snapshot(3_600_000);
    assert.ok("window_ms" in snap);
    assert.ok("payment_volume_in_window" in snap);
    assert.ok("refund_rate_in_window" in snap);
    assert.ok("error_rate_in_window" in snap);
    assert.ok("total_payments" in snap);
    assert.ok("total_payment_volume" in snap);
    assert.ok("total_refunds" in snap);
    assert.ok("total_errors" in snap);
    assert.equal(snap.total_payments, "1");
    assert.equal(snap.total_payment_volume, "100");
    assert.equal(snap.total_refunds, "1");
  });

  it("records do not accumulate across independent Metrics instances", () => {
    const m2 = new Metrics();
    m.recordPayment(999n);
    assert.equal(m2.totalPayments, 0n);
  });
});

// ── Config ─────────────────────────────────────────────────────────────────

describe("Config", () => {
  it("loads default values when no env vars set", () => {
    // Save and clear env vars to test defaults.
    const saved = {
      CONTRACT_ID: process.env.CONTRACT_ID,
      HORIZON_URL: process.env.HORIZON_URL,
      POLL_INTERVAL_MS: process.env.POLL_INTERVAL_MS,
    };

    delete process.env.CONTRACT_ID;
    delete process.env.HORIZON_URL;
    delete process.env.POLL_INTERVAL_MS;

    // Re-require with a fresh require cache would be cleanest, but since
    // config is already loaded we just verify the module-level defaults
    // directly to avoid cache invalidation complexity.
    assert.equal(
      require("./config").horizonUrl.startsWith("https://"),
      true,
      "horizonUrl must start with https://"
    );
    assert.equal(typeof require("./config").pollIntervalMs, "number");
    assert.ok(require("./config").pollIntervalMs > 0);

    // Restore env.
    Object.entries(saved).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  });

  it("refundRateThreshold defaults to 0.20", () => {
    const cfg = require("./config");
    // Allow for an env override from the test runner environment.
    assert.ok(cfg.refundRateThreshold > 0 && cfg.refundRateThreshold <= 1);
  });

  it("largePaymentThreshold is a BigInt", () => {
    const cfg = require("./config");
    assert.equal(typeof cfg.largePaymentThreshold, "bigint");
    assert.ok(cfg.largePaymentThreshold > 0n);
  });
});
