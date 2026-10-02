import { format as formatSqlQuery } from "sql-formatter";

export type SqlFormatResult =
  { ok: true; output: string } | { ok: false; error: string };

function describeSqlError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  const tokenMatch = raw.match(/Unexpected (.*?) at line (\d+) column (\d+)/);
  if (tokenMatch !== null) {
    const [, token, line, column] = tokenMatch;
    return `Некорректный SQL: неожиданный токен ${token} в строке ${line}, колонка ${column}.`;
  }

  const tokenAtMatch = raw.match(
    /at token: «(.*?)» at line (\d+) column (\d+)/
  );
  if (tokenAtMatch !== null) {
    const [, token, line, column] = tokenAtMatch;
    return `Некорректный SQL: неожиданный токен «${token}» в строке ${line}, колонка ${column}.`;
  }

  const positionMatch = raw.match(/at line (\d+) column (\d+)/);
  if (positionMatch !== null) {
    const [, line, column] = positionMatch;
    return `Некорректный SQL: ошибка синтаксиса в строке ${line}, колонка ${column}.`;
  }

  return "Некорректный SQL: проверьте синтаксис запроса.";
}

export function formatSql(input: string): SqlFormatResult {
  const source = input.trim();
  if (source.length === 0) {
    return { ok: true, output: "" };
  }

  try {
    const output = formatSqlQuery(source, {
      keywordCase: "upper",
      tabWidth: 2,
    });
    return { ok: true, output: output.trimEnd() };
  } catch (error) {
    return { ok: false, error: describeSqlError(error) };
  }
}
