import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wptRoot = path.join(repositoryRoot, "test/web-platform-tests/tests");

const patches = [
  {
    file: "tools/manifest/vcs.py",
    replacements: [
      {
        original: "except ValueError:\n    # relative import beyond toplevel throws *ValueError*!",
        replacement: "except (ValueError, ImportError):\n    # Python 2 raises ValueError here; Python 3 raises ImportError.",
        count: 1,
      },
    ],
  },
  {
    file: "tools/wptserve/wptserve/pipes.py",
    replacements: [
      { original: "from cgi import escape", replacement: "from html import escape", count: 1 },
    ],
  },
  {
    file: "tools/wptserve/wptserve/handlers.py",
    replacements: [
      { original: "import cgi", replacement: "import html", count: 1 },
      { original: "cgi.escape(", replacement: "html.escape(", count: 3 },
    ],
  },
  {
    file: "tools/runner/report.py",
    replacements: [
      { original: "from cgi import escape", replacement: "from html import escape", count: 1 },
    ],
  },
];

for (const patch of patches) {
  const filePath = path.join(wptRoot, patch.file);
  let source = await readFile(filePath, "utf8");

  for (const { original, replacement, count } of patch.replacements) {
    if (source.includes(replacement)) {
      continue;
    }
    const occurrences = source.split(original).length - 1;
    if (occurrences !== count) {
      throw new Error(`Expected ${count} patch locations in ${patch.file}; found ${occurrences}`);
    }
    source = source.replaceAll(original, replacement);
  }

  await writeFile(filePath, source);
  console.log(`Applied WPT Python 3 compatibility patches to ${patch.file}`);
}
