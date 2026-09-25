import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vcsPath = path.join(
  repositoryRoot,
  "test/web-platform-tests/tests/tools/manifest/vcs.py",
);
const original = "except ValueError:\n    # relative import beyond toplevel throws *ValueError*!";
const replacement = "except (ValueError, ImportError):\n    # Python 2 raises ValueError here; Python 3 raises ImportError.";

const source = await readFile(vcsPath, "utf8");
if (source.includes(replacement)) {
  console.log("WPT Python 3 compatibility patch is already applied");
} else {
  const occurrences = source.split(original).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected one WPT compatibility patch location; found ${occurrences}`);
  }
  await writeFile(vcsPath, source.replace(original, replacement));
  console.log("Applied WPT Python 3 compatibility patch");
}
