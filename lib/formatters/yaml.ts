import { parseDocument, type YAMLError } from "yaml";

export type YamlFormatResult =
  { ok: true; output: string } | { ok: false; error: string };

type ErrorHint = {
  pattern: RegExp;
  message: string;
};

const ERROR_REFINEMENTS: ErrorHint[] = [
  {
    pattern: /Flow sequence .*end with a \]/,
    message: "Незакрытая скобка «[» — добавьте закрывающую скобку «]».",
  },
  {
    pattern: /Flow map .*end with a \}/,
    message: "Незакрытая скобка «{» — добавьте закрывающую скобку «}».",
  },
  {
    pattern: /All mapping items must start at the same column/,
    message:
      "Элементы структуры должны начинаться с одного столбца — проверьте отступы.",
  },
  {
    pattern: /Missing closing '?quote/,
    message: "Строка не закрыта кавычкой — добавьте закрывающую кавычку.",
  },
  {
    pattern: /Implicit map keys need to be followed by map values/,
    message: "После ключа должно следовать значение через двоеточие «:».",
  },
  {
    pattern: /Missing directives-end\/doc-start indicator line/,
    message:
      "Директиве %YAML нужен разделитель «---» перед основным содержимым.",
  },
];

const ERROR_MESSAGES: Record<string, string> = {
  ALIAS_PROPS: "Алиас «&»/«*» не может содержать дополнительные свойства.",
  BAD_ALIAS: "Некорректный алиас — после «*» ожидалось имя узла.",
  BAD_DIRECTIVE: "Некорректная директива YAML (например, %YAML).",
  BAD_DQ_ESCAPE:
    "Некорректная escape-последовательность в строке в двойных кавычках.",
  BAD_INDENT: "Некорректные отступы — проверьте выравнивание структуры.",
  BAD_PROP_ORDER:
    "Якорь «&» и тег «!» должны указываться перед значением в правильном порядке.",
  BAD_SCALAR_START: "Значение начинается с недопустимого символа.",
  BLOCK_AS_IMPLICIT_KEY:
    "Ключ не может содержать блочную структуру — перенесите значение на новую строку.",
  BLOCK_IN_FLOW: "Блочная структура недопустима внутри скобок «{ }» или «[ ]».",
  DUPLICATE_KEY: "Ключи в структуре повторяются — сделайте их уникальными.",
  IMPOSSIBLE: "Некорректная структура YAML.",
  KEY_OVER_1024_CHARS: "Ключ слишком длинный (более 1024 символов).",
  MISSING_CHAR: "Отсутствует закрывающий символ — проверьте кавычки и скобки.",
  MULTILINE_IMPLICIT_KEY: "Ключ и его значение должны быть на одной строке.",
  MULTIPLE_ANCHORS: "У узла может быть только один якорь «&».",
  MULTIPLE_DOCS: "Несколько документов должны разделяться строкой «---».",
  MULTIPLE_TAGS: "У узла может быть только один тег «!».",
  NON_STRING_KEY: "Ключ должен быть строкой.",
  RESOURCE_EXHAUSTION: "Структура YAML слишком сложная для обработки.",
  TAB_AS_INDENT: "Табуляция не допускается в отступах — используйте пробелы.",
  TAG_RESOLVE_FAILED: "Некорректный тег — не удалось распознать тип значения.",
  UNEXPECTED_TOKEN:
    "Неожиданный символ — проверьте запятые, двоеточия и отступы.",
  BAD_COLLECTION_TYPE: "Некорректный тип коллекции.",
};

function describeYamlError(error: YAMLError): string {
  const refined = ERROR_REFINEMENTS.find(({ pattern }) =>
    pattern.test(error.message)
  )?.message;

  const details =
    refined ?? ERROR_MESSAGES[error.code] ?? "Ошибка в структуре YAML.";

  const position = error.linePos?.[0];
  if (position !== undefined) {
    return `Некорректный YAML: ${details} Строка ${position.line}, колонка ${position.col}.`;
  }

  return `Некорректный YAML: ${details}`;
}

export function formatYaml(input: string): YamlFormatResult {
  const source = input.trim();
  if (source.length === 0) {
    return { ok: true, output: "" };
  }

  const doc = parseDocument(source);
  const firstError = doc.errors[0];
  if (firstError !== undefined) {
    return { ok: false, error: describeYamlError(firstError) };
  }

  return { ok: true, output: doc.toString().trimEnd() };
}
