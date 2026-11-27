import type { FormatId } from "@/components/format-switcher";
import {
  PLACEHOLDER_INPUT,
  PHP_PLACEHOLDER_INPUT,
  SQL_PLACEHOLDER_INPUT,
  YAML_PLACEHOLDER_INPUT,
} from "@/lib/data";

export type PhpDirection = "toPhp" | "toJson";
export type JsonViewMode = "formatted" | "minified";

export type WorkspaceSnapshot = {
  format: FormatId;
  phpDirection: PhpDirection;
  input: string;
  viewMode: JsonViewMode;
};

export type DocumentVersion = {
  id: string;
  savedAt: number;
  label: string;
  state: WorkspaceSnapshot;
};

export type SavedDocument = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  state: WorkspaceSnapshot;
  versions: DocumentVersion[];
};

const DATABASE_NAME = "beautify-document-history";
const DATABASE_VERSION = 3;
const STORE_NAME = "documents";
const MAX_DOCUMENTS = 50;
const MAX_VERSIONS_PER_DOCUMENT = 20;

export function snapshotsEqual(
  first: WorkspaceSnapshot,
  second: WorkspaceSnapshot
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function migrateSnapshot(value: unknown): WorkspaceSnapshot {
  const legacy = value as {
    format?: FormatId;
    phpDirection?: PhpDirection;
    input?: string;
    inputs?: Partial<Record<"json" | "yaml" | "sql", string>>;
    phpJsonInput?: string;
    phpArrayInput?: string;
    viewMode?: JsonViewMode;
  };
  const format = legacy.format ?? "json";
  const phpDirection = legacy.phpDirection ?? "toPhp";
  const input =
    legacy.input ??
    (format === "php"
      ? phpDirection === "toPhp"
        ? legacy.phpJsonInput
        : legacy.phpArrayInput
      : legacy.inputs?.[format]) ??
    "";

  return {
    format,
    phpDirection,
    input,
    viewMode: legacy.viewMode ?? "formatted",
  };
}

const legacyModes: Array<{
  format: FormatId;
  phpDirection: PhpDirection;
  defaultInput: string;
}> = [
  { format: "json", phpDirection: "toPhp", defaultInput: PLACEHOLDER_INPUT },
  { format: "yaml", phpDirection: "toPhp", defaultInput: YAML_PLACEHOLDER_INPUT },
  { format: "sql", phpDirection: "toPhp", defaultInput: SQL_PLACEHOLDER_INPUT },
  { format: "php", phpDirection: "toPhp", defaultInput: PLACEHOLDER_INPUT },
  { format: "php", phpDirection: "toJson", defaultInput: PHP_PLACEHOLDER_INPUT },
];

function snapshotForMode(value: unknown, mode: (typeof legacyModes)[number]) {
  const legacy = value as {
    format?: FormatId;
    phpDirection?: PhpDirection;
    input?: string;
    inputs?: Partial<Record<"json" | "yaml" | "sql", string>>;
    phpJsonInput?: string;
    phpArrayInput?: string;
    viewMode?: JsonViewMode;
  };
  let input = mode.defaultInput;
  if (legacy.input !== undefined) {
    if (
      legacy.format === mode.format &&
      (mode.format !== "php" || legacy.phpDirection === mode.phpDirection)
    ) {
      input = legacy.input;
    }
  } else if (mode.format === "php") {
    input =
      mode.phpDirection === "toPhp"
        ? (legacy.phpJsonInput ?? input)
        : (legacy.phpArrayInput ?? input);
  } else {
    input = legacy.inputs?.[mode.format] ?? input;
  }

  return {
    format: mode.format,
    phpDirection: mode.phpDirection,
    input,
    viewMode: legacy.viewMode ?? "formatted",
  } satisfies WorkspaceSnapshot;
}

function modeKey(state: WorkspaceSnapshot): string {
  return state.format === "php"
    ? `php:${state.phpDirection}`
    : state.format;
}

function migrateLegacyDocument(
  value: unknown,
  store: IDBObjectStore,
  cursor: IDBCursorWithValue
) {
  const legacy = value as Omit<SavedDocument, "state" | "versions"> & {
    state: unknown;
    versions?: Array<{
      id: string;
      savedAt: number;
      label: string;
      state: unknown;
    }>;
  };
  const activeState = migrateSnapshot(legacy.state);
  const versions = legacy.versions ?? [];
  const activeKey = modeKey(activeState);

  for (const mode of legacyModes) {
    const state = snapshotForMode(legacy.state, mode);
    const key = modeKey(state);
    const modeVersions = versions
      .filter((version) => modeKey(migrateSnapshot(version.state)) === key)
      .map((version) => ({
        ...version,
        state: snapshotForMode(version.state, mode),
      }))
      .filter(
        (version, index, items) =>
          !snapshotsEqual(version.state, state) &&
          items.findIndex((item) =>
            snapshotsEqual(item.state, version.state)
          ) === index
      )
      .slice(-MAX_VERSIONS_PER_DOCUMENT);

    const isActiveMode = key === activeKey;
    const hasNonDefaultContent = state.input !== mode.defaultInput;
    if (!isActiveMode && !hasNonDefaultContent && modeVersions.length === 0) {
      continue;
    }

    const document: SavedDocument = {
      ...legacy,
      id: isActiveMode ? legacy.id : crypto.randomUUID(),
      title: documentTitle(state),
      updatedAt: legacy.updatedAt,
      state,
      versions: modeVersions,
    };
    if (isActiveMode) cursor.update(document);
    else store.put(document);
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Локальная база истории недоступна в этом браузере."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      let store: IDBObjectStore;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else if (transaction) {
        store = transaction.objectStore(STORE_NAME);
      } else {
        return;
      }

      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          if (event.oldVersion < 2) {
            const allDocumentsRequest = store.getAll() as IDBRequest<
              SavedDocument[]
            >;
            allDocumentsRequest.onsuccess = () => {
              allDocumentsRequest.result
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(MAX_DOCUMENTS)
                .forEach(({ id }) => store.delete(id));
            };
          }
          return;
        }
        const rawDocument = cursor.value as {
          state?: { input?: string };
          versions?: Array<{ state: { input?: string; format?: FormatId } }>;
        };
        if (event.oldVersion < 2 && rawDocument.state?.input === undefined) {
          migrateLegacyDocument(cursor.value, store, cursor);
        } else {
          const document = cursor.value as SavedDocument;
          document.state = migrateSnapshot(document.state);
          const context = modeKey(document.state);
          document.versions = (document.versions ?? [])
            .map((version) => ({
              ...version,
              state: migrateSnapshot(version.state),
            }))
            .filter((version) => modeKey(version.state) === context);
          cursor.update(document);
        }
        cursor.continue();
      };
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

function modeLabel(state: WorkspaceSnapshot): string {
  if (state.format === "php") {
    return state.phpDirection === "toPhp" ? "JSON → PHP" : "PHP → JSON";
  }
  return state.format.toUpperCase();
}

export function documentTitle(state: WorkspaceSnapshot): string {
  const content = state.input.trim();
  if (!content) return `${modeLabel(state)} — без названия`;

  const firstLine = content.split(/\r?\n/u, 1)[0].trim();
  const shortened = firstLine.length > 38
    ? `${firstLine.slice(0, 38)}…`
    : firstLine;
  return `${modeLabel(state)} — ${shortened}`;
}

export async function listDocuments(): Promise<SavedDocument[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const documents = await requestResult(
      transaction.objectStore(STORE_NAME).getAll() as IDBRequest<SavedDocument[]>
    );
    return documents.sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    database.close();
  }
}

export async function getDocument(id: string): Promise<SavedDocument | undefined> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    return await requestResult(
      transaction.objectStore(STORE_NAME).get(id) as IDBRequest<
        SavedDocument | undefined
      >
    );
  } finally {
    database.close();
  }
}

export async function saveDraft(
  id: string | null,
  state: WorkspaceSnapshot
): Promise<SavedDocument> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const now = Date.now();
    const existing = id
      ? await requestResult(store.get(id) as IDBRequest<SavedDocument | undefined>)
      : undefined;
    const document: SavedDocument = existing
      ? { ...existing, title: documentTitle(state), updatedAt: now, state }
      : {
          id: crypto.randomUUID(),
          title: documentTitle(state),
          createdAt: now,
          updatedAt: now,
          state,
          versions: [],
        };

    await requestResult(store.put(document));
    if (!existing) {
      const allDocuments = await requestResult(
        store.getAll() as IDBRequest<SavedDocument[]>
      );
      allDocuments
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(MAX_DOCUMENTS)
        .forEach(({ id: expiredId }) => store.delete(expiredId));
    }
    return document;
  } finally {
    database.close();
  }
}

export async function saveVersion(
  documentId: string,
  state: WorkspaceSnapshot,
  label = "Сохранённая версия"
): Promise<SavedDocument> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const existing = await requestResult(
      store.get(documentId) as IDBRequest<SavedDocument | undefined>
    );
    if (!existing) throw new Error("Документ истории больше не найден.");

    if (
      existing.versions.some((version) =>
        snapshotsEqual(version.state, state)
      )
    ) {
      return existing;
    }

    const version: DocumentVersion = {
      id: crypto.randomUUID(),
      savedAt: Date.now(),
      label,
      state,
    };
    const document: SavedDocument = {
      ...existing,
      title: documentTitle(state),
      updatedAt: version.savedAt,
      state,
      versions: [...existing.versions, version].slice(
        -MAX_VERSIONS_PER_DOCUMENT
      ),
    };
    await requestResult(store.put(document));
    return document;
  } finally {
    database.close();
  }
}

export async function restoreVersion(
  documentId: string,
  versionId: string
): Promise<SavedDocument> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const existing = await requestResult(
      store.get(documentId) as IDBRequest<SavedDocument | undefined>
    );
    if (!existing) throw new Error("Документ истории больше не найден.");

    const version = existing.versions.find((item) => item.id === versionId);
    if (!version) throw new Error("Выбранная версия истории не найдена.");

    if (snapshotsEqual(existing.state, version.state)) return existing;

    const now = Date.now();
    const alreadySaved = existing.versions.some((item) =>
      snapshotsEqual(item.state, existing.state)
    );
    const beforeRestore: DocumentVersion | null = alreadySaved
      ? null
      : {
          id: crypto.randomUUID(),
          savedAt: now,
          label: "Состояние до возврата",
          state: existing.state,
        };
    const document: SavedDocument = {
      ...existing,
      title: documentTitle(version.state),
      updatedAt: now,
      state: version.state,
      versions: beforeRestore
        ? [...existing.versions, beforeRestore].slice(
            -MAX_VERSIONS_PER_DOCUMENT
          )
        : existing.versions,
    };
    await requestResult(store.put(document));
    return document;
  } finally {
    database.close();
  }
}
