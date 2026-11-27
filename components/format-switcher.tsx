"use client";

import { useState } from "react";
import { Braces, Database, FileCode2, Variable } from "lucide-react";
import { cn } from "@/lib/utils";

export type FormatId = "json" | "yaml" | "sql" | "php";

type FormatOption = {
  id: FormatId;
  label: string;
  icon: typeof Braces;
};

const formatOptions: FormatOption[] = [
  { id: "json", label: "JSON", icon: Braces },
  { id: "yaml", label: "YAML", icon: FileCode2 },
  { id: "sql", label: "SQL", icon: Database },
  { id: "php", label: "PHP", icon: Variable },
];

type FormatSwitcherProps = {
  value?: FormatId;
  defaultValue?: FormatId;
  onValueChange?: (format: FormatId) => void;
};

export function FormatSwitcher({
  value,
  defaultValue = "json",
  onValueChange,
}: FormatSwitcherProps) {
  const [internalValue, setInternalValue] = useState<FormatId>(defaultValue);
  const activeFormat = value ?? internalValue;

  function selectFormat(format: FormatId) {
    setInternalValue(format);
    onValueChange?.(format);
  }

  return (
    <div
      role="tablist"
      aria-label="Формат данных"
      className="inline-flex w-full flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 sm:w-auto"
    >
      {formatOptions.map(({ id, label, icon: Icon }) => {
        const isActive = id === activeFormat;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => selectFormat(id)}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:flex-none sm:gap-2 sm:px-4 sm:text-sm",
              isActive
                ? "bg-zinc-700 text-zinc-50 shadow-sm"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
