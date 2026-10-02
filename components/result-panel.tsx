"use client";

import { useState } from "react";
import {
  AlignLeft,
  Braces,
  CheckCheck,
  Copy,
  Download,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type JsonViewMode = "formatted" | "minified";

export type ResultPanelProps = {
  result: string | null;
  emptyMessage: string;
  viewMode?: JsonViewMode;
  onViewModeChange?: (mode: JsonViewMode) => void;
  minifyAvailable?: boolean;
  fileExtension?: string;
};

const downloadMimeTypes: Record<string, string> = {
  ".json": "application/json;charset=utf-8",
  ".yml": "application/x-yaml;charset=utf-8",
  ".sql": "application/sql;charset=utf-8",
  ".php": "application/x-php;charset=utf-8",
};

export function ResultPanel({
  result,
  emptyMessage,
  viewMode = "formatted",
  onViewModeChange,
  minifyAvailable = false,
  fileExtension = ".txt",
}: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  async function handleCopy() {
    if (result === null) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success("Результат скопирован в буфер обмена");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать результат");
    }
  }

  function handleDownload() {
    if (result === null) return;
    const mimeType =
      downloadMimeTypes[fileExtension] ?? "text/plain;charset=utf-8";
    const blob = new Blob([result], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `beautify-result${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    toast.success(`Файл beautify-result${fileExtension} скачан`);
    window.setTimeout(() => setDownloaded(false), 2000);
  }

  return (
    <section
      aria-label="Область результата"
      className="flex flex-col overflow-hidden rounded-2xl border border-zinc-700/70 bg-zinc-900 shadow-xl shadow-zinc-900/20 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-zinc-800/60 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-zinc-400">
          <CheckCheck className="size-4 text-emerald-400" />
          Результат
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {minifyAvailable ? (
            <div
              role="group"
              aria-label="Вид результата"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5"
            >
              <button
                type="button"
                aria-pressed={viewMode === "formatted"}
                onClick={() => onViewModeChange?.("formatted")}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  viewMode === "formatted"
                    ? "bg-zinc-700 text-zinc-50 shadow-sm"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                )}
              >
                <AlignLeft className="size-3.5" />
                Форматированный
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "minified"}
                onClick={() => onViewModeChange?.("minified")}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  viewMode === "minified"
                    ? "bg-zinc-700 text-zinc-50 shadow-sm"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                )}
              >
                <Minimize2 className="size-3.5" />
                Минифицированный
              </button>
            </div>
          ) : (
            <span className="font-mono text-xs text-zinc-600">
              отформатировано
            </span>
          )}
          {result !== null && (
            <button
              type="button"
              aria-label="Скопировать результат в буфер обмена"
              onClick={handleCopy}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                copied
                  ? "border-emerald-400/40 text-emerald-300 hover:text-emerald-200"
                  : "text-zinc-300 hover:bg-white/10 hover:text-zinc-100"
              )}
            >
              {copied ? (
                <CheckCheck className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Скопировано" : "Копировать"}
            </button>
          )}
          {result !== null && (
            <button
              type="button"
              aria-label={`Скачать результат в файл${fileExtension}`}
              onClick={handleDownload}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                downloaded
                  ? "border-emerald-400/40 text-emerald-300 hover:text-emerald-200"
                  : "text-zinc-300 hover:bg-white/10 hover:text-zinc-100"
              )}
            >
              {downloaded ? (
                <CheckCheck className="size-3.5" />
              ) : (
                <Download className="size-3.5" />
              )}
              {downloaded ? "Скачано" : "Скачать"}
            </button>
          )}
        </div>
      </header>
      {result === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800/80">
            <Braces className="size-5 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-500">{emptyMessage}</p>
        </div>
      ) : (
        <pre className="flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed text-emerald-200/90">
          <code>{result}</code>
        </pre>
      )}
    </section>
  );
}
