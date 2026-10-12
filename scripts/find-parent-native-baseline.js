import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const inputs = ["CMakeLists.txt", "cmake", "src", "scripts", "package.json", "package-lock.json"];

export function findParentBaseline(repository, parent, api) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(parent)) {
    throw new Error("Expected repository owner/name and a full parent commit SHA");
  }
  const root = `repos/${repository}`;
  const cache = new Map();
  const request = endpoint => {
    if (!cache.has(endpoint)) cache.set(endpoint, api(endpoint));
    return cache.get(endpoint);
  };
  function artifactRun(sha) {
    const runs = request(`${root}/actions/workflows/cross-platform-source-build.yml/runs?head_sha=${sha}&status=success&per_page=30`);
    for (const run of runs.workflow_runs) {
      if (run.head_sha !== sha || run.status !== "completed" || run.conclusion !== "success") continue;
      const artifacts = request(`${root}/actions/runs/${run.id}/artifacts?per_page=100`);
      if (artifacts.artifacts.some(item => item.name === "wrtc-Linux-X64" && !item.expired)) {
        return { runId: run.id, parentSha: parent, sourceSha: sha, artifact: "wrtc-Linux-X64" };
      }
    }
    return null;
  }
  function inputTree(sha) {
    const commit = request(`${root}/git/commits/${sha}`);
    const tree = request(`${root}/git/trees/${commit.tree.sha}`);
    if (tree.truncated) throw new Error("Cannot verify a truncated native input tree");
    return inputs.map(path => {
      const entry = tree.tree.find(entry => entry.path === path);
      // Some revisions intentionally do not track a lockfile. Absence must
      // match on both sides; adding/removing one still invalidates reuse.
      if (!entry && path === "package-lock.json") return null;
      if (!entry?.sha) throw new Error(`Missing native input ${path}`);
      return entry.sha;
    });
  }
  // Merge jobs deliberately do not rebuild/reupload. First try the parent
  // itself, then its merged PR, but only with byte-identical native inputs.
  const direct = artifactRun(parent);
  if (direct) return direct;
  const pulls = request(`${root}/commits/${parent}/pulls?per_page=100`);
  for (const pull of pulls) {
    if (!pull.merged_at || pull.merge_commit_sha !== parent) continue;
    const head = pull.head.sha;
    if (JSON.stringify(inputTree(parent)) !== JSON.stringify(inputTree(head))) continue;
    const result = artifactRun(head);
    if (result) return result;
  }
  return null; // Never substitute a release or an unrelated older commit.
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = findParentBaseline(process.env.GITHUB_REPOSITORY, process.env.PARENT_SHA,
    endpoint => JSON.parse(execFileSync("gh", ["api", endpoint], { encoding: "utf8" })));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `found=${Boolean(result)}\n${result ? `run-id=${result.runId}\nsource-sha=${result.sourceSha}\n` : ""}`);
  }
  console.log(JSON.stringify(result));
  if (!result && process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      "\nParent A/B unavailable: no verified matching native artifact. No release fallback or performance conclusion.\n");
  }
}
