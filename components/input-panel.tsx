"use client";

import { AlertTriangle, TextCursorInput } from "lucide-react";
import { cn } from "@/lib/utils";

export type InputPanelProps = {
  formatLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
  error: string | null;
  readOnly?: boolean;
  placeholder?: string;
};

export function InputPanel({
  formatLabel = "JSON",
  value,
  onValueChange,
  error,
  readOnly = false,
  placeholder = '{"пример": "вставьте сюда JSON"}',
}: InputPanelProps) {
  return (
    <section
      aria-label="Область ввода"
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-zinc-900 shadow-xl shadow-zinc-900/20 animate-in fade-in slide-in-from-bottom-4 duration-500",
        error ? "border-red-500/50" : "border-zinc-700/70"
      )}
    >
      <header className="flex items-center justify-between border-b border-white/10 bg-zinc-800/60 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-zinc-400">
          <TextCursorInput className="size-4 text-zinc-300" />
          Ввод
        </span>
        <span className="font-mono text-xs text-zinc-600">{formatLabel}</span>
      </header>
      <textarea
        readOnly={readOnly}
        spellCheck={false}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-label="Данные для форматирования"
        aria-invalid={error !== null}
        placeholder={placeholder}
        className="min-h-[22rem] w-full flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-500"
      />
      {error !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 border-t border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-300"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}
