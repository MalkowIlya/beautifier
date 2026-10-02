export const PLACEHOLDER_INPUT =
  '{"service":"Beautify","description":"Приводит JSON, YAML и SQL к аккуратному читаемому виду","formats":["json","yaml","sql"],"version":0.1,"free":true}';

export const PLACEHOLDER_RESULT = `{
  "service": "Beautify",
  "description": "Приводит JSON, YAML и SQL к аккуратному читаемому виду",
  "formats": [
    "json",
    "yaml",
    "sql"
  ],
  "version": 0.1,
  "free": true
}`;

export const YAML_PLACEHOLDER_INPUT = `service: Beautify
description: "Приводит JSON, YAML и SQL к аккуратному читаемому виду"
formats:
  - json
  - yaml
  - sql
version: 0.1
free: true`;

export const SQL_PLACEHOLDER_INPUT = `SELECT u.id, u.name, COUNT(o.id) AS orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.active = true
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 0
ORDER BY u.name;`;

export const PHP_PLACEHOLDER_INPUT = `<?php

return [
    'service' => 'Beautify',
    'description' => 'Приводит JSON, YAML, SQL и PHP-массивы к аккуратному виду',
    'formats' => [
        'json',
        'yaml',
        'sql',
        'php',
    ],
    'version' => 0.1,
    'free' => true,
];`;

export const PHP_PLACEHOLDER_HINT = "['пример' => 'вставьте сюда PHP-массив']";

export const INPUT_HINTS: Record<string, string> = {
  json: '{"пример": "вставьте сюда JSON"}',
  yaml: 'service: "вставьте сюда YAML"',
  sql: "SELECT * FROM users WHERE id = 1;",
  php: PHP_PLACEHOLDER_HINT,
};
