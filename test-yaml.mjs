import { parseDocument } from "yaml";

const samples = [
  "foo: bar\n  baz: qux",
  "key: value\nkey2: [unclosed",
  "a: b\n\tc: d",
  "key: 'unclosed",
  "key: \"unclosed",
  "&anchor &anchor dup: value",
  "key: value\n: broken",
  "a: 1\na: 2\nb: 3",
  "hello:\nworld\n  indented",
  "foo:\n - item1\n -item2\n   bad",
  "- a\n- - nested",
  "key: value: extra",
  "key: { unclosed",
  "!!bad tag: value",
  "%YAML 1.2\nkey: value",
  "key: |\n  block\n  text\n key: 2",
  "key: >- \n  folded",
  "a: [1, 2, 3\nb: 4",
  "x: {a: 1, b: 2\nc: 3}",
  "123: ok\n  456: bad",
];

for (const s of samples) {
  const doc = parseDocument(s);
  console.log("INPUT:", JSON.stringify(s));
  if (doc.errors.length === 0) {
    console.log("  NO ERRORS (warnings:", doc.warnings.length + ")");
  }
  for (const e of doc.errors) {
    console.log("  msg:", JSON.stringify(e.message));
  }
  console.log("---");
}
