/**
 * Tiny assertion helpers for smoke tests.
 * Each test file uses these to validate tool output structure and sane values.
 */

let passed = 0;
let failed = 0;

export function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

export function assertEqual<T>(actual: T, expected: T, label: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    failed++;
  }
}

export function assertNotNull<T>(value: T | null | undefined, label: string): void {
  assert(value !== null && value !== undefined, label);
}

export function assertType(value: unknown, type: "string" | "number" | "boolean", label: string): void {
  assert(typeof value === type, `${label} (expected ${type}, got ${typeof value})`);
}

export function assertGreaterThan(value: number, threshold: number, label: string): void {
  assert(value > threshold, `${label} (expected > ${threshold}, got ${value})`);
}

export function assertArray(value: unknown, label: string): void {
  assert(Array.isArray(value), `${label} (expected array, got ${typeof value})`);
}

export function assertInArray<T>(value: T, arr: readonly T[], label: string): void {
  assert(arr.includes(value), `${label} (expected one of [${arr.join(", ")}], got ${JSON.stringify(value)})`);
}

export function printSummary(): void {
  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

export function resetCounters(): void {
  passed = 0;
  failed = 0;
}