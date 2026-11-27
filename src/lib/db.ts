import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createEmptyDatabase, createSeedDatabase } from "./seed-data";
import { getServerSupabase } from "./supabase";
import type { WiserdDatabase } from "./types";

const DATA_DIR = path.join(process.cwd(), ".wiserd-data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const SUPABASE_STATE_ROW_ID = "primary";

let writeQueue = Promise.resolve();
// shortcut: in-memory cache synced with Supabase wiserd_app_state JSONB; migrate readDb callers to async per-table SQL before multi-instance horizontal scaling.
let memoryCache: WiserdDatabase | null = null;
let supabaseHydrated = false;
let supabaseHydrationPromise: Promise<boolean> | null = null;

function isSupabasePersistenceEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getStorageBackend(): "supabase_postgres" | "local_json" {
  return isSupabasePersistenceEnabled() ? "supabase_postgres" : "local_json";
}

export async function ensureSupabaseHydrated(): Promise<boolean> {
  if (!isSupabasePersistenceEnabled()) return false;
  if (supabaseHydrated) return true;
  if (supabaseHydrationPromise) return supabaseHydrationPromise;

  supabaseHydrationPromise = (async () => {
    const supabase = getServerSupabase();
    if (!supabase) return false;
    try {
      const { data, error } = await supabase
        .from("wiserd_app_state")
        .select("data")
        .eq("id", SUPABASE_STATE_ROW_ID)
        .maybeSingle();
      if (error) {
        console.warn("[WISERD] Supabase read failed, falling back to local storage:", error.message);
        return false;
      }
      if (data?.data && Array.isArray((data.data as WiserdDatabase).products)) {
        const parsed = data.data as WiserdDatabase;
        if (migrateDatabaseInPlace(parsed)) {
          await supabase.from("wiserd_app_state").upsert({
            id: SUPABASE_STATE_ROW_ID,
            data: parsed,
            updated_at: new Date().toISOString(),
          });
        }
        memoryCache = parsed;
        supabaseHydrated = true;
        return true;
      }
      // First boot on a fresh Supabase project: initialize according to shouldSeedDemoData()
      const initial = createInitialDatabase();
      const { error: upsertErr } = await supabase.from("wiserd_app_state").upsert({
        id: SUPABASE_STATE_ROW_ID,
        data: initial,
        updated_at: new Date().toISOString(),
      });
      if (upsertErr) {
        console.warn("[WISERD] Supabase initial seed failed:", upsertErr.message);
        return false;
      }
      memoryCache = initial;
      supabaseHydrated = true;
      return true;
    } catch {
      return false;
    } finally {
      supabaseHydrationPromise = null;
    }
  })();

  return supabaseHydrationPromise;
}

/**
 * Production deploys default to a clean empty catalog (zero demo products/stores).
 * Demo seed only activates when WISERD_SEED_DEMO=true, or in local dev/sandbox unless explicitly disabled.
 */
export function shouldSeedDemoData(): boolean {
  if (process.env.WISERD_SEED_DEMO === "true") return true;
  if (process.env.WISERD_SEED_DEMO === "false") return false;
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.WISERD_ENABLE_LOCAL_SANDBOX === "true"
  );
}

function createInitialDatabase(): WiserdDatabase {
  return shouldSeedDemoData() ? createSeedDatabase() : createEmptyDatabase();
}

function migrateDatabaseInPlace(db: WiserdDatabase): boolean {
  let changed = false;
  const usedHandles = new Set<string>();
  for (const user of db.users) {
    if (user.handle && typeof user.handle === "string") {
      usedHandles.add(user.handle);
    }
  }
  for (const user of db.users) {
    if (!user.handle) {
      const base = slugify(user.displayName || user.id) || "member";
      let candidate = base;
      let suffix = 2;
      while (usedHandles.has(candidate)) {
        candidate = `${base}-${suffix++}`;
      }
      user.handle = candidate;
      usedHandles.add(candidate);
      changed = true;
    }
    if (!Array.isArray(user.followingUserIds)) {
      user.followingUserIds = [];
      changed = true;
    }
    if (!user.privacy) {
      user.privacy = {
        showFollowing: true,
        showSavedPosts: false,
        allowDirectMessages: true,
      };
      changed = true;
    }
  }

  const catalogUpgrades: Record<string, string> = {
    "/catalog/keyboard.svg": "/catalog/keyboard.webp",
    "/catalog/keyboard.jpg": "/catalog/keyboard.webp",
    "/catalog/desk-mat.svg": "/catalog/desk-mat.webp",
    "/catalog/desk-mat.jpg": "/catalog/desk-mat.webp",
    "/catalog/lamp.svg": "/catalog/lamp.webp",
    "/catalog/lamp.jpg": "/catalog/lamp.webp",
    "/catalog/ui-kit.svg": "/catalog/ui-kit.webp",
    "/catalog/ui-kit.jpg": "/catalog/ui-kit.webp",
    "/catalog/controller.svg": "/catalog/controller.webp",
    "/catalog/controller.jpg": "/catalog/controller.webp",
    "/catalog/coaching.svg": "/catalog/coaching.webp",
    "/catalog/coaching.jpg": "/catalog/coaching.webp",
    "/catalog/brand-service.svg": "/catalog/brand-service.webp",
    "/catalog/audit-service.svg": "/catalog/audit-service.webp",
    "/catalog/dev-service.svg": "/catalog/dev-service.webp",
  };
  for (const prod of db.products) {
    if (catalogUpgrades[prod.imageUrl]) {
      prod.imageUrl = catalogUpgrades[prod.imageUrl];
      changed = true;
    }
    if (Array.isArray(prod.gallery)) {
      prod.gallery = prod.gallery.map((url) => {
        if (catalogUpgrades[url]) {
          changed = true;
          return catalogUpgrades[url];
        }
        return url;
      });
    }
  }
  return changed;
}

// shortcut: single-node local JSON store; swap for PostgreSQL/Supabase adapter before multi-instance or serverless production.
const TRANSIENT_FS_ERRORS = new Set(["EBUSY", "EPERM", "EAGAIN", "EMFILE"]);
const READ_ONLY_FS_ERRORS = new Set(["EROFS", "EACCES", "EPERM", "ENOENT"]);

function isTransientFsError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return typeof code === "string" && TRANSIENT_FS_ERRORS.has(code);
}

function isReadOnlyFsError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return typeof code === "string" && READ_ONLY_FS_ERRORS.has(code);
}

function atomicWriteJson(filePath: string, data: WiserdDatabase): void {
  const tmpFile = `${filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const payload = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmpFile, payload, "utf8");
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.renameSync(tmpFile, filePath);
      return;
    } catch (err) {
      lastErr = err;
      if (!isTransientFsError(err) || attempt === 2) break;
    }
  }
  try {
    fs.unlinkSync(tmpFile);
  } catch {
    // ignore temp cleanup failure
  }
  throw lastErr;
}

function ensureDbFile(): WiserdDatabase {
  if (memoryCache) {
    return memoryCache;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = createInitialDatabase();
      atomicWriteJson(DB_FILE, initial);
      memoryCache = initial;
      return initial;
    }
  } catch (err) {
    if (isReadOnlyFsError(err)) {
      // Serverless hosts (Netlify/Vercel) mount the app bundle read-only; use in-memory state backed by Supabase.
      const initial = createInitialDatabase();
      memoryCache = initial;
      return initial;
    }
    throw err;
  }

  let raw: string | null = null;
  let lastReadErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      raw = fs.readFileSync(DB_FILE, "utf8");
      break;
    } catch (err) {
      lastReadErr = err;
      if (!isTransientFsError(err) || attempt === 2) break;
    }
  }
  if (raw === null) {
    throw new Error(
      `WISERD database is temporarily unreadable: ${lastReadErr instanceof Error ? lastReadErr.message : "I/O error"}`
    );
  }

  // Never overwrite an existing database file on parse/validation errors; fail closed so data is preserved.
  const parsed = JSON.parse(raw) as WiserdDatabase;
  if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.users)) {
    throw new Error("WISERD database structure is invalid; refusing to overwrite existing data.");
  }
  if (migrateDatabaseInPlace(parsed)) {
    try {
      atomicWriteJson(DB_FILE, parsed);
    } catch (err) {
      if (!isReadOnlyFsError(err)) throw err;
    }
  }
  memoryCache = parsed;
  return parsed;
}

export function readDb(): WiserdDatabase {
  if (isSupabasePersistenceEnabled() && !supabaseHydrated) {
    void ensureSupabaseHydrated();
  }
  return ensureDbFile();
}

export async function readDbAsync(): Promise<WiserdDatabase> {
  if (isSupabasePersistenceEnabled()) {
    await ensureSupabaseHydrated();
  }
  return ensureDbFile();
}

export function mutateDb<T>(mutator: (db: WiserdDatabase) => T): Promise<T> {
  const run = async (): Promise<T> => {
    if (isSupabasePersistenceEnabled()) {
      await ensureSupabaseHydrated();
    }
    const db = ensureDbFile();
    const result = mutator(db);
    memoryCache = db;
    if (isSupabasePersistenceEnabled()) {
      const supabase = getServerSupabase();
      if (supabase) {
        const { error } = await supabase.from("wiserd_app_state").upsert({
          id: SUPABASE_STATE_ROW_ID,
          data: db,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.warn("[WISERD] Supabase upsert warning:", error.message);
        }
      }
      try {
        atomicWriteJson(DB_FILE, db);
      } catch {
        // Serverless read-only filesystems skip local mirror safely when Supabase is active
      }
    } else {
      try {
        atomicWriteJson(DB_FILE, db);
      } catch (err) {
        if (!isReadOnlyFsError(err)) throw err;
      }
    }
    return result;
  };
  const next = writeQueue.then(run, run);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
