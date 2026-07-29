import type {
  MatchState,
  MatchSummary,
  Preferences,
} from "./types";

const DB_NAME = "taboo-local";
const STORE_NAME = "game";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("IndexedDB non è disponibile."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read<T>(key: string): Promise<T | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const result = await requestResult(transaction.objectStore(STORE_NAME).get(key));
    return (result as T | undefined) ?? null;
  } finally {
    database.close();
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export const localGameRepository = {
  loadPreferences: () => read<Preferences>("preferences"),
  savePreferences: (preferences: Preferences) =>
    write("preferences", preferences),
  loadActiveMatch: () => read<MatchState>("active-match"),
  saveActiveMatch: (match: MatchState) => write("active-match", match),
  loadHistory: async () => (await read<MatchSummary[]>("history")) ?? [],
  archiveMatch: async (summary: MatchSummary) => {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const history =
        ((await requestResult(store.get("history"))) as MatchSummary[] | undefined) ??
        [];
      const withoutDuplicate = history.filter((item) => item.id !== summary.id);
      store.put([summary, ...withoutDuplicate], "history");
      store.delete("active-match");
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  },
  deleteActiveMatch: async () => {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete("active-match");
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  },
  saveHistory: (history: MatchSummary[]) => write("history", history),
  clearHistory: () => write("history", []),
};

export interface LocalGameRepository {
  loadPreferences(): Promise<Preferences | null>;
  savePreferences(preferences: Preferences): Promise<void>;
  loadActiveMatch(): Promise<MatchState | null>;
  saveActiveMatch(match: MatchState): Promise<void>;
  loadHistory(): Promise<MatchSummary[]>;
  archiveMatch(summary: MatchSummary): Promise<void>;
  deleteActiveMatch(): Promise<void>;
  saveHistory(history: MatchSummary[]): Promise<void>;
  clearHistory(): Promise<void>;
}
