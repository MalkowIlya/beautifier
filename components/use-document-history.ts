"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getDocument,
  listDocuments,
  restoreVersion as restoreStoredVersion,
  saveDraft as saveStoredDraft,
  saveVersion as saveStoredVersion,
  snapshotsEqual,
  type SavedDocument,
  type WorkspaceSnapshot,
} from "@/lib/document-history";

type UseDocumentHistoryOptions = {
  snapshot: WorkspaceSnapshot;
  initialSnapshot: WorkspaceSnapshot;
  onRestore: (snapshot: WorkspaceSnapshot) => void;
};

function contextKey(snapshot: WorkspaceSnapshot): string {
  return snapshot.format === "php"
    ? `php:${snapshot.phpDirection}`
    : snapshot.format;
}

export function useDocumentHistory({
  snapshot,
  initialSnapshot,
  onRestore,
}: UseDocumentHistoryOptions) {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const snapshotRef = useRef(snapshot);
  const activeIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const sessionDocumentIdsRef = useRef(new Map<string, string>());
  const freshWorkspaceRef = useRef(false);

  snapshotRef.current = snapshot;

  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const task = queueRef.current.then(operation, operation);
    queueRef.current = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }, []);

  const refreshDocuments = useCallback(async () => {
    setDocuments(await listDocuments());
  }, []);

  const persistDraft = useCallback(async () => {
    const currentRevision = revisionRef.current;
    if (
      activeIdRef.current === null &&
      snapshotsEqual(initialSnapshot, snapshotRef.current)
    ) {
      savedRevisionRef.current = currentRevision;
      setSavedRevision(currentRevision);
      return null;
    }
    const document = await enqueue(() =>
      saveStoredDraft(activeIdRef.current, snapshotRef.current)
    );
    activeIdRef.current = document.id;
    sessionDocumentIdsRef.current.set(contextKey(document.state), document.id);
    setActiveDocumentId(document.id);
    savedRevisionRef.current = currentRevision;
    setSavedRevision(currentRevision);
    await refreshDocuments();
    return document;
  }, [enqueue, initialSnapshot, refreshDocuments]);

  const flushDraft = useCallback(async () => {
    if (revisionRef.current > savedRevisionRef.current) {
      return persistDraft();
    }
    return null;
  }, [persistDraft]);

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const storedDocuments = await listDocuments();
        if (cancelled) return;
        setDocuments(storedDocuments);
        const latest = storedDocuments[0];
        if (latest && revisionRef.current === 0) {
          activeIdRef.current = latest.id;
          freshWorkspaceRef.current = false;
          sessionDocumentIdsRef.current.set(
            contextKey(latest.state),
            latest.id
          );
          setActiveDocumentId(latest.id);
          onRestore(latest.state);
        }
      } catch {
        toast.error("Не удалось загрузить локальную историю документов");
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [onRestore]);

  useEffect(() => {
    if (!ready || revision <= savedRevision) return;
    const timer = window.setTimeout(() => {
      void persistDraft().catch(() => {
        toast.error("Не удалось сохранить документ в локальную историю");
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [persistDraft, ready, revision, savedRevision]);

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    setRevision(revisionRef.current);
  }, []);

  const openDocument = useCallback(
    async (id: string) => {
      try {
        await flushDraft();
        const document = await enqueue(() => getDocument(id));
        if (!document) return;
        activeIdRef.current = document.id;
        freshWorkspaceRef.current = false;
        sessionDocumentIdsRef.current.set(contextKey(document.state), document.id);
        setActiveDocumentId(document.id);
        savedRevisionRef.current = revisionRef.current;
        setSavedRevision(revisionRef.current);
        onRestore(document.state);
      } catch {
        toast.error("Не удалось открыть документ из истории");
      }
    },
    [enqueue, flushDraft, onRestore]
  );

  const switchContext = useCallback(
    async (format: WorkspaceSnapshot["format"], phpDirection: WorkspaceSnapshot["phpDirection"]) => {
      try {
        await flushDraft();
        const storedDocuments = await enqueue(() => listDocuments());
        setDocuments(storedDocuments);
        const key = contextKey({
          format,
          phpDirection,
          input: "",
          viewMode: "formatted",
        });
        const sessionDocumentId = sessionDocumentIdsRef.current.get(key);
        const latest = sessionDocumentId
          ? storedDocuments.find((document) => document.id === sessionDocumentId)
          : freshWorkspaceRef.current
            ? undefined
            : storedDocuments.find(
                (document) => contextKey(document.state) === key
              );
        activeIdRef.current = latest?.id ?? null;
        setActiveDocumentId(latest?.id ?? null);
        savedRevisionRef.current = revisionRef.current;
        setSavedRevision(revisionRef.current);
        if (latest) onRestore(latest.state);
      } catch {
        toast.error("Не удалось переключить режим истории");
      }
    },
    [enqueue, flushDraft, onRestore]
  );

  const startNewDocument = useCallback(async () => {
    try {
      await flushDraft();
      activeIdRef.current = null;
      sessionDocumentIdsRef.current.clear();
      freshWorkspaceRef.current = true;
      setActiveDocumentId(null);
      savedRevisionRef.current = revisionRef.current;
      setSavedRevision(revisionRef.current);
      onRestore(initialSnapshot);
    } catch {
      toast.error("Не удалось сохранить текущий документ");
    }
  }, [flushDraft, initialSnapshot, onRestore]);

  const saveVersion = useCallback(async () => {
    try {
      let document = await flushDraft();
      if (!document) {
        document = await persistDraft();
      }
      if (!document) return;
      const saved = await enqueue(() =>
        saveStoredVersion(document.id, snapshotRef.current)
      );
      setDocuments(await listDocuments());
      activeIdRef.current = saved.id;
      sessionDocumentIdsRef.current.set(contextKey(saved.state), saved.id);
      setActiveDocumentId(saved.id);
      toast.success("Версия документа сохранена");
    } catch {
      toast.error("Не удалось сохранить версию документа");
    }
  }, [enqueue, flushDraft, persistDraft]);

  const restoreVersion = useCallback(
    async (documentId: string, versionId: string) => {
      try {
        await flushDraft();
        const document = await enqueue(() =>
          restoreStoredVersion(documentId, versionId)
        );
        activeIdRef.current = document.id;
        freshWorkspaceRef.current = false;
        sessionDocumentIdsRef.current.set(contextKey(document.state), document.id);
        setActiveDocumentId(document.id);
        savedRevisionRef.current = revisionRef.current;
        setSavedRevision(revisionRef.current);
        onRestore(document.state);
        setDocuments(await listDocuments());
        toast.success("Открыта сохранённая версия");
      } catch {
        toast.error("Не удалось восстановить версию документа");
      }
    },
    [enqueue, flushDraft, onRestore]
  );

  const activeDocument = documents.find(
    (document) => document.id === activeDocumentId
  );
  const canSaveVersion = activeDocument
    ? activeDocument.versions.length > 0
      ? !activeDocument.versions.some((version) =>
          snapshotsEqual(version.state, snapshot)
        )
      : !snapshotsEqual(initialSnapshot, snapshot)
    : revision > savedRevision && !snapshotsEqual(initialSnapshot, snapshot);

  return {
    documents,
    activeDocumentId,
    hasUnsavedChanges: revision > savedRevision,
    canSaveVersion,
    markDirty,
    openDocument,
    switchContext,
    startNewDocument,
    saveVersion,
    restoreVersion,
  };
}
