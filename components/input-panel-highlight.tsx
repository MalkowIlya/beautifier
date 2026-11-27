"use client";

import { AlertTriangle, TextCursorInput } from "lucide-react";
import { useEffect, useRef } from "react";
import { CodeHighlight, syntaxLanguage } from "@/components/syntax-highlight";

type InputPanelHighlightProps = {
  formatLabel?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  extension?: string;
  error: string | null;
};

const editorTextStyle = {
  boxSizing: "border-box" as const,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.875rem",
  fontWeight: 400,
  letterSpacing: "normal",
  lineHeight: "1.625rem",
  tabSize: 2,
  whiteSpace: "pre-wrap" as const,
  overflowWrap: "anywhere" as const,
  wordBreak: "normal" as const,
};

export function InputPanelHighlight({
  formatLabel = "JSON",
  value,
  onChange,
  placeholder = "",
  extension,
  error,
}: InputPanelHighlightProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const language = extension ? syntaxLanguage(extension) : "json";

  useEffect(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (!textarea || !highlight) return;

    const syncScroll = () => {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    };

    textarea.addEventListener("scroll", syncScroll);
    return () => textarea.removeEventListener("scroll", syncScroll);
  }, []);

  return (
    <section
      aria-label="Область ввода"
      className={`relative flex flex-col overflow-hidden rounded-2xl border bg-zinc-900 shadow-xl shadow-zinc-900/20 animate-in fade-in slide-in-from-bottom-4 duration-500 ${
        error ? "border-red-500/50" : "border-zinc-700/70"
      }`}
    >
      <header className="flex items-center justify-between border-b border-white/10 bg-zinc-800/60 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-zinc-400">
          <TextCursorInput className="size-4 text-zinc-300" />
          Ввод
        </span>
        <span className="font-mono text-xs text-zinc-600">{formatLabel}</span>
      </header>
      <div className="relative min-h-[24rem] flex-1 overflow-hidden xl:min-h-[30rem]">
        <div
          ref={highlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-auto p-4 text-zinc-200"
          style={editorTextStyle}
        >
          {value ? (
            <CodeHighlight language={language}>{value}</CodeHighlight>
          ) : (
            <span className="text-zinc-600">{placeholder}</span>
          )}
        </div>
        <textarea
          ref={textareaRef}
          spellCheck={false}
          wrap="soft"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Данные для форматирования"
          aria-invalid={error !== null}
          placeholder={placeholder}
          className="absolute inset-0 h-full min-h-[24rem] w-full resize-none overflow-auto bg-transparent p-4 text-transparent caret-zinc-200 outline-none placeholder:text-transparent selection:bg-blue-400/30 xl:min-h-[30rem]"
          style={editorTextStyle}
        />
      </div>
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
