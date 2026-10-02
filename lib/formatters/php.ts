import { describeJsonError } from "@/lib/formatters/json";

export type PhpFormatResult =
  { ok: true; output: string } | { ok: false; error: string };

type JsValue =
  string | number | boolean | null | JsValue[] | { [key: string]: JsValue };

const INDENT_SIZE = 4;

function quotePhpString(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  const needsDouble =
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes("\t") ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);

  if (!needsDouble) {
    return "'" + value.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
  }

  let out = '"';
  for (const ch of value) {
    switch (ch) {
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "$":
        out += "\\$";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      default: {
        const code = ch.codePointAt(0);
        if (code !== undefined && (code < 0x20 || code === 0x7f)) {
          out += `\\u{${code.toString(16)}}`;
        } else {
          out += ch;
        }
      }
    }
  }
  return out + '"';
}

function renderValue(value: JsValue, indent: number): string {
  const pad = " ".repeat(indent);
  const childPad = " ".repeat(indent + INDENT_SIZE);

  if (value === null) return "null";
  if (typeof value === "string") return quotePhpString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map(
      (item) => childPad + renderValue(item, indent + INDENT_SIZE)
    );
    return `[\n${items.join(",\n")},\n${pad}]`;
  }

  const entries = Object.entries(value as Record<string, JsValue>);
  if (entries.length === 0) return "[]";
  const items = entries.map(
    ([key, item]) =>
      `${childPad}${quotePhpString(key)} => ${renderValue(item, indent + INDENT_SIZE)}`
  );
  return `[\n${items.join(",\n")},\n${pad}]`;
}

export function jsonToPhp(input: string): PhpFormatResult {
  const source = input.trim();
  if (source.length === 0) {
    return { ok: true, output: "" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    return { ok: false, error: describeJsonError(source, error) };
  }

  const body = renderValue(parsed as JsValue, 0);
  return { ok: true, output: `<?php\n\nreturn ${body};\n` };
}

class PhpParseError extends Error {
  line: number;
  col: number;

  constructor(message: string, line: number, col: number) {
    super(message);
    this.name = "PhpParseError";
    this.line = line;
    this.col = col;
  }
}

type TokenType = "symbol" | "string" | "number" | "word" | "end";

type Token = {
  type: TokenType;
  value: string | number | boolean;
  line: number;
  col: number;
};

class PhpScanner {
  private source: string;
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(source: string) {
    this.source = source;
  }

  nextToken(): Token {
    this.skipTrivia();

    const line = this.line;
    const col = this.col;
    const ch = this.peek();

    if (ch === "") {
      return { type: "end", value: "", line, col };
    }

    if (
      ch === "[" ||
      ch === "]" ||
      ch === "(" ||
      ch === ")" ||
      ch === "," ||
      ch === ";"
    ) {
      this.advance();
      return { type: "symbol", value: ch, line, col };
    }

    if (ch === "=") {
      this.advance();
      if (this.peek() === ">") {
        this.advance();
        return { type: "symbol", value: "=>", line, col };
      }
      this.fail("Ожидалась стрелка «=>» после символа «=».", line, col);
    }

    if (ch === "$") {
      this.fail(
        "Переменные PHP (например, $var) не поддерживаются — вставьте только массив со значениями.",
        line,
        col
      );
    }

    if (ch === "'" || ch === '"') {
      return this.readString(ch, line, col);
    }

    if (
      /[0-9]/.test(ch) ||
      ((ch === "-" || ch === "+") && /[0-9]/.test(this.peek(1)))
    ) {
      return this.readNumber(line, col);
    }

    if (/[A-Za-z_\x80-\xff]/.test(ch)) {
      return this.readWord(line, col);
    }

    this.fail(`Неожиданный символ «${ch}».`, line, col);
  }

  private advance(): string {
    const ch = this.source[this.pos] ?? "";
    this.pos += 1;
    if (ch === "\n") {
      this.line += 1;
      this.col = 1;
    } else {
      this.col += 1;
    }
    return ch;
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? "";
  }

  private fail(message: string, line: number, col: number): never {
    throw new PhpParseError(message, line, col);
  }

  private skipTrivia(): void {
    for (;;) {
      while (this.peek() !== "" && /\s/.test(this.peek())) {
        this.advance();
      }

      if (this.peek() === "/" && this.peek(1) === "/") {
        while (this.peek() !== "" && this.peek() !== "\n") this.advance();
        continue;
      }

      if (this.peek() === "#") {
        while (this.peek() !== "" && this.peek() !== "\n") this.advance();
        continue;
      }

      if (this.peek() === "/" && this.peek(1) === "*") {
        const startLine = this.line;
        const startCol = this.col;
        this.advance();
        this.advance();
        let closed = false;
        while (this.peek() !== "") {
          if (this.peek() === "*" && this.peek(1) === "/") {
            this.advance();
            this.advance();
            closed = true;
            break;
          }
          this.advance();
        }
        if (!closed) {
          this.fail(
            "Незакрытый блочный комментарий /* */.",
            startLine,
            startCol
          );
        }
        continue;
      }

      break;
    }
  }

  private readString(quote: string, line: number, col: number): Token {
    this.advance();
    let out = "";

    for (;;) {
      const ch = this.peek();
      if (ch === "") {
        this.fail("Строка не закрыта кавычкой.", line, col);
      }
      if (ch === quote) {
        this.advance();
        break;
      }
      if (ch === "\\") {
        this.advance();
        const esc = this.peek();
        if (quote === "'") {
          if (esc === "\\" || esc === "'") {
            this.advance();
            out += esc;
          } else {
            out += "\\";
          }
          continue;
        }
        switch (esc) {
          case "n":
            this.advance();
            out += "\n";
            break;
          case "r":
            this.advance();
            out += "\r";
            break;
          case "t":
            this.advance();
            out += "\t";
            break;
          case "v":
            this.advance();
            out += "\v";
            break;
          case "e":
            this.advance();
            out += "\x1b";
            break;
          case "f":
            this.advance();
            out += "\f";
            break;
          case "\\":
            this.advance();
            out += "\\";
            break;
          case '"':
            this.advance();
            out += '"';
            break;
          case "$":
            this.advance();
            out += "$";
            break;
          case "0":
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7": {
            let octal = "";
            while (octal.length < 3 && /[0-7]/.test(this.peek())) {
              octal += this.advance();
            }
            out += String.fromCharCode(parseInt(octal, 8));
            break;
          }
          case "x": {
            this.advance();
            let hex = "";
            while (hex.length < 2 && /[0-9a-fA-F]/.test(this.peek())) {
              hex += this.advance();
            }
            out +=
              hex.length === 0 ? "x" : String.fromCharCode(parseInt(hex, 16));
            break;
          }
          case "u": {
            if (this.peek(1) === "{") {
              this.advance();
              this.advance();
              let hex = "";
              while (/[0-9a-fA-F]/.test(this.peek())) {
                hex += this.advance();
              }
              if (this.peek() !== "}") {
                this.fail(
                  "В Unicode-escape \\u{...} ожидалась закрывающая скобка «}».",
                  this.line,
                  this.col
                );
              }
              this.advance();
              const code = parseInt(hex, 16);
              if (!Number.isFinite(code) || code > 0x10ffff) {
                this.fail("Некорректный Unicode-escape \\u{...}.", line, col);
              }
              out += String.fromCodePoint(code);
            } else {
              out += "u";
            }
            break;
          }
          case "\n":
            this.advance();
            break;
          default:
            this.advance();
            out += esc;
        }
        continue;
      }
      out += this.advance();
    }

    return { type: "string", value: out, line, col };
  }

  private readNumber(line: number, col: number): Token {
    const negative = this.peek() === "-";
    if (this.peek() === "-" || this.peek() === "+") {
      this.advance();
    }

    if (this.peek() === "0" && /[xX]/.test(this.peek(1))) {
      let raw = this.advance();
      raw += this.advance();
      while (/[0-9a-fA-F]/.test(this.peek())) raw += this.advance();
      const value = parseInt(raw, 16);
      return { type: "number", value: negative ? -value : value, line, col };
    }

    if (this.peek() === "0" && /[bB]/.test(this.peek(1))) {
      let raw = this.advance();
      raw += this.advance();
      while (/[01]/.test(this.peek())) raw += this.advance();
      const value = parseInt(raw, 2);
      return { type: "number", value: negative ? -value : value, line, col };
    }

    let raw = "";
    while (/[0-9]/.test(this.peek())) raw += this.advance();

    if (this.peek() === "." && /[0-9]/.test(this.peek(1))) {
      raw += this.advance();
      while (/[0-9]/.test(this.peek())) raw += this.advance();
    }

    if (/[eE]/.test(this.peek())) {
      const savePos = this.pos;
      const saveLine = this.line;
      const saveCol = this.col;
      let exp = this.advance();
      if (this.peek() === "-" || this.peek() === "+") exp += this.advance();
      if (/[0-9]/.test(this.peek())) {
        while (/[0-9]/.test(this.peek())) exp += this.advance();
        raw += exp;
      } else {
        this.pos = savePos;
        this.line = saveLine;
        this.col = saveCol;
      }
    }

    const value = Number(raw);
    return { type: "number", value: negative ? -value : value, line, col };
  }

  private readWord(line: number, col: number): Token {
    let word = "";
    while (/[A-Za-z0-9_\x80-\xff]/.test(this.peek())) {
      word += this.advance();
    }
    return { type: "word", value: word, line, col };
  }
}

type PrimitiveKey = string | number | boolean | null;

type ArrayEntry =
  | { kind: "keyed"; key: PrimitiveKey; value: JsValue }
  | { kind: "plain"; value: JsValue };

class PhpParser {
  private tokens: Token[];
  private pos = 0;

  constructor(source: string) {
    const scanner = new PhpScanner(source);
    const tokens: Token[] = [];
    for (;;) {
      const token = scanner.nextToken();
      tokens.push(token);
      if (token.type === "end") break;
    }
    this.tokens = tokens;
  }

  parseExpression(): JsValue {
    const value = this.parseValue();
    const next = this.peek();
    if (next.type === "symbol" && next.value === ";") {
      this.next();
    }
    if (this.peek().type !== "end") {
      this.fail("После выражения обнаружены лишние данные.");
    }
    return value;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const token = this.tokens[this.pos];
    if (token.type !== "end") {
      this.pos += 1;
    }
    return token;
  }

  private fail(message: string): never {
    const token = this.peek();
    throw new PhpParseError(message, token.line, token.col);
  }

  private expectSymbol(value: string): Token {
    const token = this.peek();
    if (token.type !== "symbol" || token.value !== value) {
      this.fail(`Ожидался символ «${value}».`);
    }
    return this.next();
  }

  private parseValue(): JsValue {
    const token = this.peek();

    if (token.type === "string" || token.type === "number") {
      this.next();
      return token.value as JsValue;
    }

    if (token.type === "word") {
      const word = String(token.value).toLowerCase();
      if (word === "array") {
        this.next();
        return this.parseArray("(");
      }
      if (word === "true") {
        this.next();
        return true;
      }
      if (word === "false") {
        this.next();
        return false;
      }
      if (word === "null") {
        this.next();
        return null;
      }
      this.fail(
        `Неизвестная конструкция «${String(token.value)}» — поддерживаются массивы, строки, числа, true, false и null.`
      );
    }

    if (token.type === "symbol" && token.value === "[") {
      return this.parseArray("[");
    }

    if (token.type === "symbol" && token.value === "(") {
      this.next();
      const inner = this.parseValue();
      this.expectSymbol(")");
      return inner;
    }

    this.fail(
      "Ожидалось значение: массив, строка, число, true, false или null."
    );
  }

  private parseArray(open: "[" | "("): JsValue {
    const close = open === "[" ? "]" : ")";
    this.expectSymbol(open);
    const entries: ArrayEntry[] = [];

    for (;;) {
      const token = this.peek();
      if (token.type === "symbol" && token.value === close) {
        this.next();
        break;
      }
      if (token.type === "end") {
        this.fail(
          `Незакрытый массив: ожидалась закрывающая скобка «${close}».`
        );
      }

      const first = this.parseValue();
      if (this.peek().type === "symbol" && this.peek().value === "=>") {
        this.next();
        if (first !== null && typeof first === "object") {
          this.fail("Ключ массива не может быть массивом или объектом.");
        }
        const second = this.parseValue();
        entries.push({
          kind: "keyed",
          key: first as PrimitiveKey,
          value: second,
        });
      } else {
        entries.push({ kind: "plain", value: first });
      }

      const after = this.peek();
      if (after.type === "symbol" && after.value === ",") {
        this.next();
        const trailing = this.peek();
        if (trailing.type === "symbol" && trailing.value === close) {
          this.next();
          break;
        }
        continue;
      }
      if (after.type === "symbol" && after.value === close) {
        this.next();
        break;
      }
      this.fail("Ожидалась запятая «,» или закрывающая скобка массива.");
    }

    return evaluateEntries(entries);
  }
}

function normalizeKey(key: PrimitiveKey): string {
  if (typeof key === "string") return key;
  if (typeof key === "number") return String(Math.trunc(key));
  if (key === true) return "1";
  if (key === false) return "0";
  return "";
}

function evaluateEntries(entries: ArrayEntry[]): JsValue {
  const map = new Map<string, JsValue>();
  const order: string[] = [];
  let maxIntKey = -1;

  for (const entry of entries) {
    let key: string;
    if (entry.kind === "keyed") {
      if (typeof entry.key === "number") {
        maxIntKey = Math.max(maxIntKey, Math.trunc(entry.key));
      }
      key = normalizeKey(entry.key);
    } else {
      const index = maxIntKey + 1;
      maxIntKey = index;
      key = String(index);
    }
    if (!map.has(key)) order.push(key);
    map.set(key, entry.value);
  }

  const size = map.size;
  let isList = true;
  for (let i = 0; i < size; i += 1) {
    if (!map.has(String(i))) {
      isList = false;
      break;
    }
  }

  if (isList) {
    const list: JsValue[] = [];
    for (let i = 0; i < size; i += 1) {
      list.push(map.get(String(i)) as JsValue);
    }
    return list;
  }

  const object: Record<string, JsValue> = {};
  for (const key of order) {
    object[key] = map.get(key) as JsValue;
  }
  return object;
}

export function phpToJson(input: string): PhpFormatResult {
  const source = input.trim();
  if (source.length === 0) {
    return { ok: true, output: "" };
  }

  let body = source;
  if (body.toLowerCase().startsWith("<?php")) {
    body = body.slice(5);
  }
  if (body.trimEnd().endsWith("?>")) {
    body = body.slice(0, body.lastIndexOf("?>"));
  }
  body = body.trim();
  if (body.toLowerCase().startsWith("return")) {
    body = body.slice("return".length);
  }

  try {
    const parser = new PhpParser(body);
    const value = parser.parseExpression();
    const output = JSON.stringify(value, null, 2);
    return { ok: true, output: output ?? "null" };
  } catch (error) {
    if (error instanceof PhpParseError) {
      return {
        ok: false,
        error: `Некорректный PHP-массив: ${error.message} Строка ${error.line}, колонка ${error.col}.`,
      };
    }
    return {
      ok: false,
      error: "Некорректный PHP-массив: не удалось распознать структуру.",
    };
  }
}
