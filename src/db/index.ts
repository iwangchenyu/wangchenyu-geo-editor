const DB_NAME = 'wangchenyu-geo-editor-db';
const STORE_NAME = 'sqlite_db';
let db: any = null;
let currentEnterpriseId: string | null = null;

declare const initSqlJs: (config?: any) => Promise<any>;

// --- IndexedDB 持久化（兼容所有环境） ---
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openIDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('db');
      req.onsuccess = () => resolve(req.result ? new Uint8Array(req.result) : null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function saveToIDB(data: Uint8Array): Promise<void> {
  try {
    const idb = await openIDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(data, 'db');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// --- OPFS 持久化（localhost/HTTPS 环境优先，更快） ---
async function loadFromOPFS(): Promise<Uint8Array | null> {
  try {
    if (!navigator?.storage?.getDirectory) return null;
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(DB_NAME);
    const file = await fh.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch { return null; }
}

async function saveToOPFS(data: Uint8Array): Promise<boolean> {
  try {
    if (!navigator?.storage?.getDirectory) return false;
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle(DB_NAME, { create: true });
    const w = await fh.createWritable();
    await w.write(data as unknown as ArrayBuffer);
    await w.close();
    return true;
  } catch { return false; }
}

async function load(): Promise<Uint8Array | null> {
  // 优先 OPFS，失败回退 IndexedDB
  const opfs = await loadFromOPFS();
  if (opfs && opfs.length > 0) return opfs;
  return loadFromIDB();
}

async function save(data: Uint8Array): Promise<void> {
  const ok = await saveToOPFS(data);
  if (!ok) await saveToIDB(data);
}

// --- 数据库初始化 ---
export async function initDatabase(): Promise<any> {
  if (db) return db;

  const SQL = await initSqlJs({ locateFile: (file: string) => `/${file}` });

  const stored = await load();
  if (stored && stored.length > 0) {
    db = new SQL.Database(stored);
  } else {
    db = new SQL.Database();
    const { SCHEMA_SQL, SEED_SQL } = await import('./schema');
    db.run(SCHEMA_SQL);
    db.run(SEED_SQL);
    await persistDatabase();
  }
  // Ensure demo enterprise exists on every startup (INSERT OR IGNORE = idempotent)
  const { buildDemoSQL } = await import('./demo-data');
  db.run(buildDemoSQL());
  await persistDatabase();
  return db;
}

export async function persistDatabase() {
  if (!db) return;
  await save(db.export());
}

export function getDatabase(): any {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function getCurrentEnterpriseId(): string | null { return currentEnterpriseId; }
export function setCurrentEnterpriseId(id: string | null) { currentEnterpriseId = id; }

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
}

export function queryOne<T>(sql: string, params: any[] = []): T | null {
  const d = getDatabase();
  const stmt = d.prepare(sql);
  try {
    stmt.bind(params);
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      const row: any = {};
      cols.forEach((c: string, i: number) => { row[c] = vals[i]; });
      return row as T;
    }
    return null;
  } finally { stmt.free(); }
}

export function queryAll<T>(sql: string, params: any[] = []): T[] {
  const d = getDatabase();
  const results: T[] = [];
  const stmt = d.prepare(sql);
  try {
    stmt.bind(params);
    while (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      const row: any = {};
      cols.forEach((c: string, i: number) => { row[c] = vals[i]; });
      results.push(row as T);
    }
    return results;
  } finally { stmt.free(); }
}

export function execute(sql: string, params: any[] = []): void {
  getDatabase().run(sql, params);
}
