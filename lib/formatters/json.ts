export type JsonFormatResult =
  { ok: true; output: string } | { ok: false; error: string };

type ErrorHint = {
  pattern: RegExp;
  message: string;
};

const ERROR_HINTS: ErrorHint[] = [
  {
    pattern: /Unexpected end of JSON input/,
    message: "JSON оборван — проверьте, что все скобки { } и [ ] закрыты.",
  },
  {
    pattern: /Expected ',' or '\}' after property value/,
    message: "После значения ожидалась запятая или закрывающая скобка }.",
  },
  {
    pattern: /Expected ',' or '\]' after array element/,
    message:
      "После элемента массива ожидалась запятая или закрывающая скобка ].",
  },
  {
    pattern: /Expected property name or '\}'/,
    message: "Ожидалось имя свойства в кавычках или закрывающая скобка }.",
  },
  {
    pattern: /Expected double-quoted property name/,
    message: "Имя свойства должно быть строкой в двойных кавычках.",
  },
  {
    pattern: /Expected '\:'/,
    message: "Между ключом и значением ожидается двоеточие «:».",
  },
  {
    pattern: /Unexpected end of string/,
    message: "Строка не закрыта закрывающей кавычкой.",
  },
  {
    pattern: /Bad control character in string literal/,
    message:
      "В строке встречается управляющий символ — экранируйте его (например, \\n).",
  },
  {
    pattern: /Bad escaped character/,
    message: "Некорректная escape-последовательность в строке.",
  },
  {
    pattern: /Invalid Unicode escape/,
    message: "Некорректный Unicode-escape (например, \\uXXXX).",
  },
  {
    pattern: /Invalid number/,
    message: "Некорректный формат числа.",
  },
  {
    pattern: /Unexpected number/,
    message: "Неожиданное число — возможно, пропущена запятая или двоеточие.",
  },
  {
    pattern: /Unexpected string/,
    message: "Неожиданная строка — возможно, пропущена запятая или двоеточие.",
  },
  {
    pattern: /Unexpected identifier/,
    message:
      "Некорректное значение: допускаются строки, числа, true, false и null.",
  },
  {
    pattern: /Unexpected non-whitespace character after JSON/,
    message: "После завершения JSON остались лишние данные.",
  },
  {
    pattern: /Unexpected token/,
    message: "Неожиданный символ — проверьте запятые и скобки.",
  },
];

export function describeJsonError(source: string, error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  const positionMatch = raw.match(/position\s+(\d+)/);
  const position = positionMatch ? Number(positionMatch[1]) : null;

  const hint = ERROR_HINTS.find(({ pattern }) => pattern.test(raw));

  let details = hint?.message ?? "Ошибка в структуре JSON.";
  if (position !== null) {
    const char = source[position];
    const charInfo = char === undefined ? "" : `, найден символ «${char}»`;
    details += ` Позиция ${position}${charInfo}.`;
  }

  return `Некорректный JSON: ${details}`;
}

function stringifyJson(input: string, compact: boolean): JsonFormatResult {
  const source = input.trim();
  if (source.length === 0) {
    return { ok: true, output: "" };
  }

  try {
    const parsed = JSON.parse(source);
    const output = compact
      ? JSON.stringify(parsed)
      : JSON.stringify(parsed, null, 2);
    return { ok: true, output: output ?? "" };
  } catch (error) {
    return { ok: false, error: describeJsonError(source, error) };
  }
}

export function formatJson(input: string): JsonFormatResult {
  return stringifyJson(input, false);
}

export function minifyJson(input: string): JsonFormatResult {
  return stringifyJson(input, true);
}
