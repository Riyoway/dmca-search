// Builds site/data/index.json from the file listing of github/dmca.
// A blobless, depth-1 clone fetches only commit + tree objects, so this
// stays fast even though the upstream repo has ~15 years of history.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const UPSTREAM = "https://github.com/github/dmca.git";
const TMP = "tmp/dmca";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });

rmSync(TMP, { recursive: true, force: true });
git("clone", "--depth", "1", "--filter=blob:none", "--no-checkout", UPSTREAM, TMP);

const commit = git("-C", TMP, "rev-parse", "HEAD").trim();
const paths = git("-C", TMP, "ls-tree", "-r", "--name-only", "HEAD")
  .split("\n")
  .filter((p) => /^\d{4}\//.test(p) && /\.(md|markdown)$/.test(p))
  .sort();

if (paths.length < 1000) {
  throw new Error(`suspiciously small index (${paths.length} paths) — upstream layout changed?`);
}

mkdirSync("site/data", { recursive: true });
writeFileSync(
  "site/data/index.json",
  JSON.stringify({ generated: new Date().toISOString(), commit, paths }),
);
rmSync(TMP, { recursive: true, force: true });

console.log(`indexed ${paths.length} notices at ${commit.slice(0, 7)}`);
