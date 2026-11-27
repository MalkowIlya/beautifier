import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type Language = "json" | "yaml" | "sql" | "php";

const map: Record<string, Language> = {
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  php: "php",
};

export function highlightStyle() {
  return oneDark;
}

export function syntaxLanguage(ext: string): Language {
  return map[ext.replace(/^\./, "")] ?? "json";
}

type Props = {
  language: Language;
  children: string;
  className?: string;
};

export function CodeHighlight({ language, children, className }: Props) {
  return (
    <SyntaxHighlighter
      language={language}
      style={oneDark}
      wrapLongLines
      codeTagProps={{
        style: {
          display: "block",
          whiteSpace: "inherit",
          overflowWrap: "inherit",
          wordBreak: "inherit",
          font: "inherit",
        },
      }}
      customStyle={{
        margin: 0,
        padding: 0,
        width: "100%",
        minWidth: 0,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        background: "transparent",
        fontSize: "0.875rem",
        lineHeight: "1.625rem",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        wordBreak: "normal",
        tabSize: 2,
      }}
      className={className}
    >
      {children}
    </SyntaxHighlighter>
  );
}
