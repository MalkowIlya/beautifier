"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Clock3, FileClock, RotateCcw } from "lucide-react";
import type { SavedDocument } from "@/lib/document-history";

type DocumentHistoryPanelProps = {
  documents: SavedDocument[];
  activeDocumentId: string | null;
  hasUnsavedChanges: boolean;
  canSaveVersion: boolean;
  onOpenDocument: (id: string) => void;
  onSaveVersion: () => void;
  onRestoreVersion: (documentId: string, versionId: string) => void;
};

const HISTORY_EXPANDED_STORAGE_KEY = "beautify-history-expanded";

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function versionCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} версия`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} версии`;
  }
  return `${count} версий`;
}

export function DocumentHistoryPanel({
  documents,
  activeDocumentId,
  hasUnsavedChanges,
  canSaveVersion,
  onOpenDocument,
  onSaveVersion,
  onRestoreVersion,
}: DocumentHistoryPanelProps) {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [expandedDocuments, setExpandedDocuments] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setHistoryExpanded(
          window.localStorage.getItem(HISTORY_EXPANDED_STORAGE_KEY) === "true",
        );
      } catch {
        // Keep the accordion collapsed if browser storage is unavailable.
      }
      setStorageReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(
        HISTORY_EXPANDED_STORAGE_KEY,
        String(historyExpanded),
      );
    } catch {
      // The accordion still works for this session without persistent storage.
    }
  }, [historyExpanded, storageReady]);

  return (
    <section
      aria-label="История документов"
      className="mt-6 rounded-2xl border border-zinc-700/70 bg-zinc-900 shadow-xl shadow-zinc-950/30 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <button
        type="button"
        aria-expanded={historyExpanded}
        aria-controls="document-history-content"
        onClick={() => setHistoryExpanded((expanded) => !expanded)}
        className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-4 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-white/40 sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
            <FileClock className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-zinc-100">
              История документов
            </span>
            <span className="mt-0.5 block truncate text-xs text-zinc-500">
              {documents.length} документов
              {hasUnsavedChanges ? " · сохраняю изменения…" : ""}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 text-zinc-400 transition-transform ${
            historyExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id="document-history-content"
        hidden={!historyExpanded}
        className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            В этом браузере · до 50 документов и 20 версий на документ ·
            автосохранение через секунду после правок.
          </p>
          <button
            type="button"
            onClick={onSaveVersion}
            disabled={!canSaveVersion}
            title={
              canSaveVersion
                ? "Сохранить текущее состояние как версию"
                : "Версия доступна после изменений"
            }
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5"
          >
            <Clock3 className="size-4" />
            Сохранить версию
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-zinc-800 text-zinc-500">
              <FileClock className="size-5" />
            </div>
            <p className="text-sm text-zinc-300">История пока пуста</p>
            <p className="text-xs text-zinc-500">
              Внесите изменения в данные — документ появится здесь
              автоматически.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((document) => {
              const active = document.id === activeDocumentId;
              const versions = [...document.versions].sort(
                (a, b) => b.savedAt - a.savedAt,
              );

              return (
                <article
                  key={document.id}
                  className={`rounded-xl border p-3 ${
                    active
                      ? "border-blue-400/30 bg-blue-400/5"
                      : "border-white/5 bg-zinc-800/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenDocument(document.id)}
                    aria-current={active ? "true" : undefined}
                    className="flex w-full min-w-0 items-start justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-100">
                        {document.title}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        Изменён {formatTimestamp(document.updatedAt)}
                        {active ? " · открыт" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-400">
                      {versionCountLabel(versions.length)}
                    </span>
                  </button>

                  {versions.length > 0 && (
                    <div className="mt-3 border-t border-white/5 pt-2">
                      <button
                        type="button"
                        aria-expanded={expandedDocuments[document.id] === true}
                        onClick={() =>
                          setExpandedDocuments((previous) => ({
                            ...previous,
                            [document.id]: !previous[document.id],
                          }))
                        }
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <span>
                          История версий · {versionCountLabel(versions.length)}
                        </span>
                        <ChevronDown
                          className={`size-4 transition-transform ${
                            expandedDocuments[document.id] ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {expandedDocuments[document.id] && (
                        <div className="mt-1 space-y-1">
                          {versions.map((version) => (
                            <button
                              key={version.id}
                              type="button"
                              onClick={() =>
                                onRestoreVersion(document.id, version.id)
                              }
                              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <RotateCcw className="size-3.5 shrink-0" />
                                <span className="truncate">
                                  {version.label === "Перед восстановлением"
                                    ? "Состояние до возврата"
                                    : version.label}
                                </span>
                              </span>
                              <span className="shrink-0 text-zinc-600">
                                {formatTimestamp(version.savedAt)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
