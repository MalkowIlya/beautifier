"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Wand2 } from "lucide-react";
import { FormatSwitcher, type FormatId } from "@/components/format-switcher";
import { InputPanel } from "@/components/input-panel";
import { ResultPanel } from "@/components/result-panel";
import {
  INPUT_HINTS,
  PHP_PLACEHOLDER_HINT,
  PHP_PLACEHOLDER_INPUT,
  PLACEHOLDER_INPUT,
  PLACEHOLDER_RESULT,
  SQL_PLACEHOLDER_INPUT,
  YAML_PLACEHOLDER_INPUT,
} from "@/lib/data";
import { formatJson, minifyJson } from "@/lib/formatters/json";
import { formatYaml } from "@/lib/formatters/yaml";
import { formatSql } from "@/lib/formatters/sql";
import { jsonToPhp, phpToJson } from "@/lib/formatters/php";
import { cn } from "@/lib/utils";
import type { JsonViewMode } from "@/components/result-panel";

type BaseFormat = Exclude<FormatId, "php">;
type PhpDirection = "toPhp" | "toJson";

const formatLabels: Record<BaseFormat, string> = {
  json: "JSON",
  yaml: "YAML",
  sql: "SQL",
};

const fileExtensions: Record<FormatId, string> = {
  json: ".json",
  yaml: ".yml",
  sql: ".sql",
  php: ".php",
};

export function BeautifyWorkspace() {
  const [format, setFormat] = useState<FormatId>("json");
  const [inputs, setInputs] = useState<Record<BaseFormat, string>>({
    json: PLACEHOLDER_INPUT,
    yaml: YAML_PLACEHOLDER_INPUT,
    sql: SQL_PLACEHOLDER_INPUT,
  });
  const [phpJsonInput, setPhpJsonInput] = useState(PLACEHOLDER_INPUT);
  const [phpArrayInput, setPhpArrayInput] = useState(PHP_PLACEHOLDER_INPUT);
  const [phpDirection, setPhpDirection] = useState<PhpDirection>("toPhp");
  const [viewMode, setViewMode] = useState<JsonViewMode>("formatted");

  const isJson = format === "json";
  const isYaml = format === "yaml";
  const isSql = format === "sql";
  const isPhp = format === "php";

  const currentInput = isPhp
    ? phpDirection === "toPhp"
      ? phpJsonInput
      : phpArrayInput
    : inputs[format];

  const formatted = useMemo(() => {
    if (isJson) {
      return viewMode === "minified"
        ? minifyJson(inputs.json)
        : formatJson(inputs.json);
    }
    if (isYaml) {
      return formatYaml(inputs.yaml);
    }
    if (isSql) {
      return formatSql(inputs.sql);
    }
    if (isPhp) {
      return phpDirection === "toPhp"
        ? jsonToPhp(currentInput)
        : phpToJson(currentInput);
    }
    return null;
  }, [
    isJson,
    isYaml,
    isSql,
    isPhp,
    inputs,
    currentInput,
    phpDirection,
    viewMode,
  ]);

  const error = formatted !== null && !formatted.ok ? formatted.error : null;

  const result =
    formatted === null
      ? PLACEHOLDER_RESULT
      : formatted.ok && formatted.output.length > 0
        ? formatted.output
        : null;

  function handleInputChange(value: string) {
    if (isPhp) {
      if (phpDirection === "toPhp") {
        setPhpJsonInput(value);
      } else {
        setPhpArrayInput(value);
      }
      return;
    }
    setInputs((prev) => ({ ...prev, [format]: value }));
  }

  function handleDirectionChange(direction: PhpDirection) {
    setPhpDirection(direction);
  }

  const inputPlaceholder = isPhp
    ? phpDirection === "toPhp"
      ? INPUT_HINTS.json
      : PHP_PLACEHOLDER_HINT
    : INPUT_HINTS[format];

  const inputFormatLabel = isPhp
    ? phpDirection === "toPhp"
      ? "JSON → PHP"
      : "PHP → JSON"
    : formatLabels[format];

  const emptyMessage = isJson
    ? "Вставьте корректный JSON — результат появится здесь"
    : isYaml
      ? "Вставьте корректный YAML — результат появится здесь"
      : isSql
        ? "Вставьте SQL-запрос — результат появится здесь"
        : isPhp
          ? phpDirection === "toPhp"
            ? "Вставьте корректный JSON — PHP-массив появится здесь"
            : "Вставьте корректный PHP-массив — JSON появится здесь"
          : "Результат ещё не сформирован";

  return (
    <section className="relative mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-5 rounded-2xl border border-zinc-700/70 bg-zinc-900 p-5 shadow-2xl shadow-zinc-950/40 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-800/80">
            <Wand2 className="size-5 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Beautify</h1>
            <p className="mt-0.5 font-mono text-xs text-zinc-500">
              {"// вставь данные — получи порядок"}
            </p>
          </div>
        </div>
        <FormatSwitcher value={format} onValueChange={setFormat} />
      </div>

      {isPhp && (
        <div
          role="group"
          aria-label="Направление конвертации PHP"
          className="mt-4 inline-flex items-center gap-1 rounded-lg border border-zinc-700/70 bg-zinc-800/60 p-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <button
            type="button"
            aria-pressed={phpDirection === "toPhp"}
            onClick={() => handleDirectionChange("toPhp")}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              phpDirection === "toPhp"
                ? "bg-zinc-700 text-zinc-50 shadow-sm"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            )}
          >
            <ArrowRightLeft className="size-4" />
            JSON → PHP-массив
          </button>
          <button
            type="button"
            aria-pressed={phpDirection === "toJson"}
            onClick={() => handleDirectionChange("toJson")}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              phpDirection === "toJson"
                ? "bg-zinc-700 text-zinc-50 shadow-sm"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            )}
          >
            <ArrowRightLeft className="size-4" />
            PHP-массив → JSON
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <InputPanel
          formatLabel={inputFormatLabel}
          value={currentInput}
          onValueChange={handleInputChange}
          error={error}
          placeholder={inputPlaceholder}
        />
        <ResultPanel
          result={result}
          emptyMessage={emptyMessage}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          minifyAvailable={isJson && result !== null}
          fileExtension={fileExtensions[format]}
        />
      </div>
    </section>
  );
}
