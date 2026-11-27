"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, FilePlus2 } from "lucide-react";
import { FormatSwitcher, type FormatId } from "@/components/format-switcher";
import { DocumentHistoryPanel } from "@/components/document-history-panel";
import { InputPanel } from "@/components/input-panel";
import { ResultPanel } from "@/components/result-panel";
import { useDocumentHistory } from "@/components/use-document-history";
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
import { syntaxLanguage } from "@/components/syntax-highlight";
import type { JsonViewMode } from "@/components/result-panel";
import type { PhpDirection, WorkspaceSnapshot } from "@/lib/document-history";

type BaseFormat = Exclude<FormatId, "php">;

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

function createInitialSnapshot(): WorkspaceSnapshot {
  return {
    format: "json",
    phpDirection: "toPhp",
    input: PLACEHOLDER_INPUT,
    viewMode: "formatted",
  };
}

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
  const [headerControlsSlot, setHeaderControlsSlot] =
    useState<HTMLElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHeaderControlsSlot(
        document.getElementById("workspace-header-controls"),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const isJson = format === "json";
  const isYaml = format === "yaml";
  const isSql = format === "sql";
  const isPhp = format === "php";
  const currentInput = isPhp
    ? phpDirection === "toPhp"
      ? phpJsonInput
      : phpArrayInput
    : inputs[format];

  const initialSnapshot = useMemo(() => createInitialSnapshot(), []);
  const snapshot = useMemo<WorkspaceSnapshot>(
    () => ({
      format,
      phpDirection,
      input: currentInput,
      viewMode,
    }),
    [currentInput, format, phpDirection, viewMode],
  );

  const restoreSnapshot = useCallback((restored: WorkspaceSnapshot) => {
    setFormat(restored.format);
    setPhpDirection(restored.phpDirection);
    if (restored.format === "php") {
      if (restored.phpDirection === "toPhp") {
        setPhpJsonInput(restored.input);
      } else {
        setPhpArrayInput(restored.input);
      }
    } else {
      setInputs((previous) => ({
        ...previous,
        [restored.format]: restored.input,
      }));
    }
    setViewMode(restored.viewMode);
  }, []);

  const history = useDocumentHistory({
    snapshot,
    initialSnapshot,
    onRestore: restoreSnapshot,
  });

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
    history.markDirty();
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
    if (direction === phpDirection) return;
    void history.switchContext("php", direction).then(() => {
      setPhpDirection(direction);
    });
  }

  function handleFormatChange(nextFormat: FormatId) {
    if (nextFormat === format) return;
    void history.switchContext(nextFormat, phpDirection).then(() => {
      setFormat(nextFormat);
    });
  }

  function handleViewModeChange(mode: JsonViewMode) {
    history.markDirty();
    setViewMode(mode);
  }

  async function handleNewDocument() {
    await history.startNewDocument();
    setFormat(initialSnapshot.format);
    setInputs({
      json: PLACEHOLDER_INPUT,
      yaml: YAML_PLACEHOLDER_INPUT,
      sql: SQL_PLACEHOLDER_INPUT,
    });
    setPhpJsonInput(PLACEHOLDER_INPUT);
    setPhpArrayInput(PHP_PLACEHOLDER_INPUT);
    setPhpDirection(initialSnapshot.phpDirection);
    setViewMode(initialSnapshot.viewMode);
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
    <>
      {headerControlsSlot &&
        createPortal(
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <FormatSwitcher value={format} onValueChange={handleFormatChange} />
            {isPhp && (
              <div
                role="group"
                aria-label="Направление конвертации PHP"
                className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1"
              >
                <button
                  type="button"
                  aria-pressed={phpDirection === "toPhp"}
                  onClick={() => handleDirectionChange("toPhp")}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:text-sm",
                    phpDirection === "toPhp"
                      ? "bg-zinc-700 text-zinc-50 shadow-sm"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                  )}
                >
                  <ArrowRightLeft className="size-4" />
                  JSON → PHP
                </button>
                <button
                  type="button"
                  aria-pressed={phpDirection === "toJson"}
                  onClick={() => handleDirectionChange("toJson")}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:text-sm",
                    phpDirection === "toJson"
                      ? "bg-zinc-700 text-zinc-50 shadow-sm"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                  )}
                >
                  <ArrowRightLeft className="size-4" />
                  PHP → JSON
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleNewDocument}
              aria-label="Создать новый документ"
              title="Новый документ"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <FilePlus2 className="size-4" />
              <span>Новый</span>
            </button>
          </div>,
          headerControlsSlot,
        )}
      <section className="relative mx-auto w-full max-w-[1600px]">
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <InputPanel
            formatLabel={inputFormatLabel}
            value={currentInput}
            onValueChange={handleInputChange}
            error={error}
            placeholder={inputPlaceholder}
            highlight={true}
            extension={fileExtensions[format]}
          />
          <ResultPanel
            result={result}
            emptyMessage={emptyMessage}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            minifyAvailable={isJson && result !== null}
            fileExtension={fileExtensions[format]}
            language={syntaxLanguage(fileExtensions[format])}
          />
        </div>
        <DocumentHistoryPanel
          documents={history.documents}
          activeDocumentId={history.activeDocumentId}
          hasUnsavedChanges={history.hasUnsavedChanges}
          canSaveVersion={history.canSaveVersion}
          onOpenDocument={(id) => void history.openDocument(id)}
          onSaveVersion={() => void history.saveVersion()}
          onRestoreVersion={(documentId, versionId) =>
            void history.restoreVersion(documentId, versionId)
          }
        />
      </section>
    </>
  );
}
