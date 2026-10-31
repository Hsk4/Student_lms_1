/**
 * Test environment. Every value here points at the throwaway database in
 * `lms-test-db` (docker, port 5434); nothing here touches a real database.
 * The URL can be overridden with TEST_DATABASE_URL.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://test:test@localhost:5434/lms_test";
process.env.CLERK_SECRET_KEY =
  process.env.TEST_CLERK_SECRET_KEY ?? "sk_test_placeholder_for_unit_tests";
process.env.CLERK_WEBHOOK_SIGNING_SECRET =
  process.env.TEST_CLERK_WEBHOOK_SECRET ??
  "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

// A 5-minute window makes the per-minute limits meaningless for a suite that
// fires dozens of requests in seconds; the limits themselves are not under test.
process.env.RATE_LIMIT_WINDOW_MS = "300000";
process.env.RATE_LIMIT_MAX = "100000";
