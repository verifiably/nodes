import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const repo = fileURLToPath(new URL("../../", import.meta.url));

it("retains actual Vitest module and skip evidence after tt exits", async () => {
  const root = mkdtempSync(join(tmpdir(), "nodes-ci-evidence-"));
  const env = {
    PATH: `${join(root, "bin")}:${dirname(process.execPath)}:${process.env.PATH}`,
    HOME: join(root, "home"),
    GIT_CONFIG_GLOBAL: join(root, "home/gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
    FIXTURE_ROOT: root,
    TT_LOG: join(root, "runs.jsonl"),
    TT_FORCE: "1",
    NODES_CI_EVIDENCE_DIR: join(root, "evidence with spaces"),
  };
  try {
    for (const dir of ["home", "bin", "tools", "ts", "evidence with spaces"]) {
      mkdirSync(join(root, dir));
    }
    const git = (...args: string[]) => spawnSync("git", args, { cwd: root, env, encoding: "utf8" });
    expect(git("init", "-q").status).toBe(0);
    expect(git("rev-parse", "--show-toplevel").stdout.trim()).toBe(root);
    expect(git("rev-parse", "--absolute-git-dir").stdout.trim()).toBe(join(root, ".git"));
    copyFileSync(join(repo, "tools/tt"), join(root, "tools/tt"));
    copyFileSync(join(repo, "justfile"), join(root, "justfile"));
    writeFileSync(
      join(root, "bin/tasks"),
      '#!/usr/bin/env python3\nimport json,os\nprint(json.dumps({"project":{"root":os.environ["FIXTURE_ROOT"],"prefix":"fixture","linked":False}}))\n',
      { mode: 0o755 },
    );
    symlinkSync(resolve(repo, "ts/node_modules"), join(root, "ts/node_modules"), "dir");
    writeFileSync(
      join(root, "ts/package.json"),
      JSON.stringify({
        type: "module",
        scripts: {
          test: "node node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1",
        },
      }),
    );
    writeFileSync(
      join(root, "ts/some.test.js"),
      'import {it} from "vitest";it("passes",()=>{});it.skip("guarded",()=>{});',
    );
    writeFileSync(
      join(root, "ts/whole.test.js"),
      'import {describe,it} from "vitest";describe.skip("whole module",()=>{it("guarded module",()=>{});});',
    );
    const child = spawn("just", ["--set", "ts_check_cmd", "true", "ci-typescript"], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const stop = () => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32") child.kill("SIGKILL");
        else process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    };
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(stop, 20_000);
    let status: number | null;
    try {
      status = await new Promise<number | null>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", resolve);
      });
    } finally {
      clearTimeout(timer);
      stop();
    }
    expect(status, output).toBe(0);
    const xml = readFileSync(join(env.NODES_CI_EVIDENCE_DIR, "vitest.xml"), "utf8");
    expect(xml).toContain('tests="3"');
    expect(xml.match(/<skipped\b/g)).toHaveLength(2);
    expect(xml).toContain("some.test.js");
    expect(xml).toContain("whole.test.js");
    // Vitest omits runtime reasons: the packet must label guard-derived reasons.
    const skippedNames = [...xml.matchAll(/<testcase\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/testcase>/g)]
      .filter((match) => match[2].includes("<skipped"))
      .map((match) => match[1])
      .sort();
    expect(skippedNames).toEqual(["guarded", "whole module &gt; guarded module"]);
    expect(readFileSync(join(root, "ts/some.test.js"), "utf8")).toContain('it.skip("guarded"');
    expect(readFileSync(join(root, "ts/whole.test.js"), "utf8")).toContain('describe.skip("whole module"');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
