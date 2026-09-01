import "@testing-library/react";

// Deterministic timezone. Several helpers format in Europe/London explicitly,
// but anything that falls back to the host zone should not depend on where CI
// happens to run.
process.env.TZ = "Europe/London";

// Values the lazily-validated env module needs when a test touches it. These
// are obvious fakes; nothing in the unit suite talks to a real service.
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
