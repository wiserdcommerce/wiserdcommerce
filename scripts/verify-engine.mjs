import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// 1. Verify SQL Blueprint completeness (all 16 tables + RLS + English/UTC default)
const sqlPath = path.resolve("supabase/migrations/001_wiserd_master_schema.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

assert.match(sql, /default 'en'/, "SQL default language must be 'en'");
assert.match(sql, /default 'UTC'/, "SQL default timezone must be 'UTC'");

const requiredTables = [
  "profiles",
  "topics",
  "entities",
  "user_interests",
  "sources",
  "articles",
  "article_topics",
  "intelligence_updates",
  "update_sources",
  "daily_briefings",
  "research_sessions",
  "research_messages",
  "saved_items",
  "feedback",
  "notification_preferences",
  "background_jobs",
];

for (const tbl of requiredTables) {
  assert.match(
    sql,
    new RegExp(`create table if not exists public\\.${tbl}\\b`),
    `Missing table definition: ${tbl}`
  );
  assert.match(
    sql,
    new RegExp(`alter table public\\.${tbl} enable row level security;`),
    `Missing RLS enablement on table: ${tbl}`
  );
}

// 2. Verify zero em/en dashes and UTC-only timestamps in src/
function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full));
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const forbiddenTokens = ["Asia/Jakarta"];

for (const file of walk(path.resolve("src"))) {
  const content = fs.readFileSync(file, "utf8");
  assert.ok(!content.includes("—"), `Em-dash found in ${file}`);
  assert.ok(!content.includes("–"), `En-dash found in ${file}`);
  for (const token of forbiddenTokens) {
    assert.ok(!content.includes(token), `Forbidden timezone token "${token}" found in ${file}`);
  }
}

// 3. Verify Base Enterprise Currency & Commerce Router contracts + Migration 002
const tokenSol = fs.readFileSync(path.resolve("contracts/WiserdEnterpriseCurrency.sol"), "utf8");
const routerSol = fs.readFileSync(path.resolve("contracts/WiserdCommerceRouter.sol"), "utf8");
const sql002 = fs.readFileSync(path.resolve("supabase/migrations/002_base_commerce_and_supply.sql"), "utf8");

assert.match(tokenSol, /MAX_SUPPLY\s*=\s*1_000_000_000/, "WSRD contract must enforce 1B MAX_SUPPLY cap");
assert.match(routerSol, /settleThirdPartyOrder/, "Commerce router must implement settleThirdPartyOrder");
assert.match(sql002, /commerce_orders/, "Migration 002 must define commerce_orders table");

console.log("✓ WISERD strict English, UTC, zero-dash, 16-table SQL, and Base Commerce contract checks passed.");
