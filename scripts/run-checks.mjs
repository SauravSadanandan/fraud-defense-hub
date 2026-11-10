#!/usr/bin/env bun
/**
 * Quality Gate & Verification History Runner
 * Executes the full test/lint/build/security gate, records step logs,
 * writes report.md and report.json into test-history/<runId>/,
 * and maintains test-history/INDEX.md and test-history/LATEST.md.
 */

import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";

// 1. Resolve repository root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

// 2. Parse CLI arguments
const args = process.argv.slice(2);
let skipRules = false;
let label = "";
let keepCount = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--skip-rules") {
    skipRules = true;
  } else if (arg.startsWith("--label=")) {
    label = arg.slice(8);
  } else if (arg === "--label" && i + 1 < args.length) {
    label = args[++i];
  } else if (arg.startsWith("--keep=")) {
    keepCount = parseInt(arg.slice(7), 10);
  } else if (arg === "--keep" && i + 1 < args.length) {
    keepCount = parseInt(args[++i], 10);
  }
}

// 3. Collect System & Git Metadata
function getGitInfo() {
  let branch = "unknown";
  let shortSha = "unknown";
  let dirtyCount = 0;

  try {
    const bRes = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (bRes.status === 0 && bRes.stdout) branch = bRes.stdout.trim();
  } catch {
    /* ignore */
  }

  try {
    const sRes = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (sRes.status === 0 && sRes.stdout) shortSha = sRes.stdout.trim();
  } catch {
    /* ignore */
  }

  try {
    const dRes = spawnSync("git", ["status", "--porcelain"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (dRes.status === 0 && dRes.stdout) {
      const lines = dRes.stdout.trim().split("\n").filter(Boolean);
      dirtyCount = lines.length;
    }
  } catch {
    /* ignore */
  }

  return { branch, shortSha, isDirty: dirtyCount > 0, dirtyCount };
}

function getToolVersion(cmd, args = ["--version"]) {
  try {
    const res = spawnSync(cmd, args, { encoding: "utf8", timeout: 5000 });
    if (cmd === "java") {
      const out = (res.stderr || res.stdout || "").trim();
      if (res.status === 0 && out) {
        return out.split("\n")[0].trim();
      }
      return "not found";
    }
    if (res.status === 0 && res.stdout) {
      return res.stdout.trim().split("\n")[0].trim();
    }
    return "not found";
  } catch {
    return "not found";
  }
}

function getFormattedTime(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const YYYY = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const DD = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  const tzOffsetMin = -now.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? "+" : "-";
  const tzH = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
  const tzM = pad(Math.abs(tzOffsetMin) % 60);

  return {
    localFormatted: `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss} (UTC${sign}${tzH}:${tzM})`,
    localIso: `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}${sign}${tzH}:${tzM}`,
    utcIso: now.toISOString(),
    folderTimestamp: `${YYYY}-${MM}-${DD}_${hh}${mm}${ss}`,
  };
}

const timeMeta = getFormattedTime();
const gitMeta = getGitInfo();
const toolsMeta = {
  bun: getToolVersion("bun"),
  node: getToolVersion("node"),
  java: getToolVersion("java", ["-version"]),
  firebase: getToolVersion("firebase"),
};

// 4. Setup run directory
const sanitizedBranch = gitMeta.branch.replace(/[^a-zA-Z0-9._-]/g, "-");
const runId = `${timeMeta.folderTimestamp}_${sanitizedBranch}_${gitMeta.shortSha}`;
const testHistoryDir = join(repoRoot, "test-history");
const runDir = join(testHistoryDir, runId);
const logsDir = join(runDir, "logs");

mkdirSync(logsDir, { recursive: true });

// 5. Execution Helpers
function runStepCommand(name, commandString) {
  const startTime = Date.now();
  try {
    const res = spawnSync(commandString, {
      cwd: repoRoot,
      shell: true,
      encoding: "utf8",
      env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
      maxBuffer: 15 * 1024 * 1024,
    });
    const durationMs = Date.now() - startTime;
    const stdout = res.stdout || "";
    const stderr = res.stderr || "";
    const combinedLog = (stdout + (stderr ? "\n" + stderr : "")).trim();
    const exitCode = res.status ?? (res.error ? 1 : 0);

    return {
      name,
      command: commandString,
      status: exitCode === 0 ? "PASS" : "FAIL",
      skipKind: null,
      exitCode,
      durationMs,
      durationStr: durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`,
      log: combinedLog,
      error: res.error ? res.error.message : null,
      reason: null,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    return {
      name,
      command: commandString,
      status: "FAIL",
      skipKind: null,
      exitCode: 1,
      durationMs,
      durationStr: `${durationMs}ms`,
      log: err.message,
      error: err.message,
      reason: null,
    };
  }
}

function stripAnsi(str) {
  return str ? str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "") : "";
}

function parseVitestOutput(output) {
  const clean = stripAnsi(output);
  const filesMatch = clean.match(/Test Files\s+([^\n\r]+)/i);
  const testsMatch = clean.match(/Tests\s+([^\n\r]+)/i);
  return {
    testFiles: filesMatch ? filesMatch[1].trim() : "counts unavailable",
    tests: testsMatch ? testsMatch[1].trim() : "counts unavailable",
  };
}

function getLast60Lines(log) {
  if (!log) return "";
  const lines = log.split("\n");
  return lines.slice(-60).join("\n");
}

// 6. Security Scanner
function runSecurityScan() {
  const startTime = Date.now();
  const forbiddenPatterns = [
    { name: "DEFAULT_PASS", regex: /\bDEFAULT_PASS\b/g },
    { name: "AdcountyAdmin", regex: /AdcountyAdmin/g },
    { name: "signInAnonymously", regex: /\bsignInAnonymously\b/g },
    { name: "ensureFirebaseSession", regex: /\bensureFirebaseSession\b/g },
    { name: "farg.local", regex: /farg\.local/g },
    {
      name: "forbidden-email-domain",
      regex: /[a-zA-Z0-9._%+-]+@(gmail\.com|rplg\.io)\b/gi,
    },
  ];

  const filesToScan = [];
  const excludedDirs = new Set([
    "node_modules",
    "dist",
    "test-history",
    ".git",
    ".output",
    ".vinxi",
    "sample-data",
  ]);

  function walk(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!excludedDirs.has(entry.name)) {
            walk(join(dir, entry.name));
          }
        } else if (entry.isFile()) {
          const fullPath = join(dir, entry.name);
          if (fullPath === __filename) continue;
          filesToScan.push(fullPath);
        }
      }
    } catch {
      /* ignore */
    }
  }

  for (const sub of ["src", "tests", "docs", "scripts"]) {
    const p = join(repoRoot, sub);
    if (existsSync(p)) walk(p);
  }

  try {
    const rootEntries = readdirSync(repoRoot, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile()) {
        if (
          entry.name.endsWith(".md") ||
          entry.name.startsWith("firestore.rules") ||
          entry.name === "firebase.json"
        ) {
          filesToScan.push(join(repoRoot, entry.name));
        }
      }
    }
  } catch {
    /* ignore */
  }

  const hits = [];
  for (const file of filesToScan) {
    try {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of forbiddenPatterns) {
          pattern.regex.lastIndex = 0;
          if (pattern.regex.test(line)) {
            hits.push({
              file: relative(repoRoot, file),
              line: i + 1,
              pattern: pattern.name,
            });
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const durationMs = Date.now() - startTime;
  const isPass = hits.length === 0;

  const logLines = [
    `Security scan scanned ${filesToScan.length} files.`,
    isPass
      ? "PASS: No forbidden literals or credentials found."
      : `FAIL: Found ${hits.length} forbidden literal hit(s):`,
  ];
  if (!isPass) {
    hits.forEach((h) => logLines.push(`  - ${h.file}:${h.line} [${h.pattern}]`));
  }

  return {
    name: "security-scan",
    command: "internal security scanner (regex pattern audit)",
    status: isPass ? "PASS" : "FAIL",
    skipKind: null,
    exitCode: isPass ? 0 : 1,
    durationMs,
    durationStr: durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`,
    log: logLines.join("\n"),
    error: isPass ? null : `Detected ${hits.length} forbidden credential or pattern hits`,
    reason: null,
    scannedFilesCount: filesToScan.length,
    hits,
  };
}

// 6b. Environment Isolation Checker
function runEnvIsolationCheck() {
  const startTime = Date.now();
  const logLines = [];
  const errors = [];

  const requiredKeys = [
    "VITE_APP_ENV",
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
  ];

  function parseEnvFile(filePath) {
    if (!existsSync(filePath)) {
      errors.push(`Missing env file: ${relative(repoRoot, filePath)}`);
      return {};
    }
    const content = readFileSync(filePath, "utf8");
    const map = {};
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        const k = line.slice(0, eqIdx).trim();
        const v = line.slice(eqIdx + 1).trim();
        map[k] = v;
      }
    }
    return map;
  }

  const prodEnvPath = join(repoRoot, ".env.production");
  const stagingEnvPath = join(repoRoot, ".env.staging");

  const prodEnv = parseEnvFile(prodEnvPath);
  const stagingEnv = parseEnvFile(stagingEnvPath);

  for (const k of requiredKeys) {
    if (!prodEnv[k]) errors.push(`.env.production missing required key: ${k}`);
    if (!stagingEnv[k]) errors.push(`.env.staging missing required key: ${k}`);
  }

  if (prodEnv["VITE_APP_ENV"] !== "production") {
    errors.push(
      `.env.production VITE_APP_ENV is "${prodEnv["VITE_APP_ENV"]}", expected "production"`,
    );
  }
  if (stagingEnv["VITE_APP_ENV"] !== "staging") {
    errors.push(`.env.staging VITE_APP_ENV is "${stagingEnv["VITE_APP_ENV"]}", expected "staging"`);
  }

  for (const [k, v] of Object.entries(prodEnv)) {
    if (v.includes("REPLACE") || v.includes("<<")) {
      errors.push(`.env.production key "${k}" contains placeholder token: "${v}"`);
    }
  }
  for (const [k, v] of Object.entries(stagingEnv)) {
    if (v.includes("REPLACE") || v.includes("<<")) {
      errors.push(`.env.staging key "${k}" contains placeholder token: "${v}"`);
    }
  }

  const prodProjectId = prodEnv["VITE_FIREBASE_PROJECT_ID"];
  const stagingProjectId = stagingEnv["VITE_FIREBASE_PROJECT_ID"];
  if (prodProjectId && stagingProjectId && prodProjectId === stagingProjectId) {
    errors.push(
      `VITE_FIREBASE_PROJECT_ID must differ between environments (both are "${prodProjectId}")`,
    );
  }

  logLines.push(`[env-isolation] .env.production project: ${prodProjectId || "MISSING"}`);
  logLines.push(`[env-isolation] .env.staging project: ${stagingProjectId || "MISSING"}`);

  const clientDir = join(repoRoot, "dist", "client");
  if (!existsSync(clientDir)) {
    errors.push(`dist/client directory not found to verify environment isolation`);
  } else {
    let foundProdId = false;
    let foundStagingId = false;

    function searchDir(dir) {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(full);
        } else if (entry.isFile()) {
          try {
            const txt = readFileSync(full, "utf8");
            if (prodProjectId && txt.includes(prodProjectId)) foundProdId = true;
            if (stagingProjectId && txt.includes(stagingProjectId)) foundStagingId = true;
          } catch {
            /* ignore binary files */
          }
        }
      }
    }

    searchDir(clientDir);

    if (!foundProdId) {
      errors.push(`Production project id "${prodProjectId}" NOT found in dist/client build output`);
    } else {
      logLines.push(
        `[env-isolation] Confirmed production project id "${prodProjectId}" present in dist/client`,
      );
    }

    if (foundStagingId) {
      errors.push(
        `Staging project id "${stagingProjectId}" LEAKED into production dist/client build output!`,
      );
    } else {
      logLines.push(
        `[env-isolation] Confirmed staging project id "${stagingProjectId}" absent from dist/client`,
      );
    }
  }

  const durationMs = Date.now() - startTime;
  const isPass = errors.length === 0;

  if (isPass) {
    logLines.push("[env-isolation] Environment isolation checks passed successfully.");
  } else {
    for (const err of errors) {
      logLines.push(`[env-isolation FAIL] ${err}`);
    }
  }

  return {
    name: "env-isolation",
    command: "internal environment isolation verifier",
    status: isPass ? "PASS" : "FAIL",
    skipKind: null,
    exitCode: isPass ? 0 : 1,
    durationMs,
    durationStr: durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`,
    log: logLines.join("\n"),
    error: isPass ? null : errors.join("; "),
    reason: null,
    prodProjectId: prodProjectId || null,
    stagingProjectId: stagingProjectId || null,
  };
}

// 7. Run Verification Steps
const steps = [];

console.log(`[verify] Starting quality gate run: ${runId}`);

// Step 1: Install
console.log(`[verify] 1/8 Running install check (bun install --frozen-lockfile)...`);
const installStep = runStepCommand("install", "bun install --frozen-lockfile");
if (installStep.status === "FAIL") {
  installStep.log +=
    "\n\n[FAIL NOTE]: bun install --frozen-lockfile failed. The lockfile is likely out of date. Run 'bun install' to synchronize.";
}
writeFileSync(join(logsDir, "install.log"), installStep.log, "utf8");
steps.push(installStep);

// Step 2: Lint
console.log(`[verify] 2/8 Running linter (bun run lint)...`);
const lintStep = runStepCommand("lint", "bun run lint");
writeFileSync(join(logsDir, "lint.log"), lintStep.log, "utf8");
steps.push(lintStep);

// Step 3: Typecheck
console.log(`[verify] 3/8 Running typecheck (bun run typecheck)...`);
const typecheckStep = runStepCommand("typecheck", "bun run typecheck");
writeFileSync(join(logsDir, "typecheck.log"), typecheckStep.log, "utf8");
steps.push(typecheckStep);

// Step 4: Build & Index Verification
console.log(`[verify] 4/8 Running build (bun run build)...`);
const buildStep = runStepCommand("build", "bun run build");
const indexPath = join(repoRoot, "dist", "client", "index.html");
const indexExists = existsSync(indexPath);

if (buildStep.status === "PASS" && !indexExists) {
  buildStep.status = "FAIL";
  buildStep.exitCode = 1;
  buildStep.log +=
    "\n\n[FAIL NOTE]: Build succeeded but expected client entry point 'dist/client/index.html' does not exist.";
} else {
  buildStep.log += `\n\n[VERIFY]: 'dist/client/index.html' verified present (${indexExists ? "OK" : "MISSING"}).`;
}
buildStep.indexHtmlVerified = indexExists;
writeFileSync(join(logsDir, "build.log"), buildStep.log, "utf8");
steps.push(buildStep);

// Step 5: Environment Isolation Check
console.log(`[verify] 5/8 Running environment isolation check...`);
const envIsoStep = runEnvIsolationCheck();
writeFileSync(join(logsDir, "env-isolation.log"), envIsoStep.log, "utf8");
steps.push(envIsoStep);

// Step 6: Unit & Drift Tests
console.log(`[verify] 6/8 Running unit & drift tests (bun run test)...`);
const unitStep = runStepCommand("unit-tests", "bun run test");
unitStep.parsedCounts = parseVitestOutput(unitStep.log);
writeFileSync(join(logsDir, "unit-tests.log"), unitStep.log, "utf8");
steps.push(unitStep);

// Step 7: Rules Tests (Emulator)
console.log(`[verify] 7/8 Checking rules tests...`);
let rulesStep;
if (skipRules) {
  rulesStep = {
    name: "rules-tests",
    command: "bun run test:rules",
    status: "SKIPPED",
    skipKind: "flag",
    exitCode: 0,
    durationMs: 0,
    durationStr: "0ms",
    log: "Skipped by user flag (--skip-rules).",
    error: null,
    reason: "skipped by flag",
  };
} else if (toolsMeta.java === "not found" || toolsMeta.firebase === "not found") {
  const missing = [];
  if (toolsMeta.java === "not found") missing.push("Java Runtime (java)");
  if (toolsMeta.firebase === "not found") missing.push("Firebase CLI (firebase)");
  rulesStep = {
    name: "rules-tests",
    command: "bun run test:rules",
    status: "SKIPPED",
    skipKind: "environment",
    exitCode: 0,
    durationMs: 0,
    durationStr: "0ms",
    log: `Skipped: ${missing.join(" and ")} not found on PATH. Firebase emulator requires Java and Firebase CLI.`,
    error: null,
    reason: `${missing.join(" and ")} not found on PATH`,
  };
} else {
  rulesStep = runStepCommand("rules-tests", "bun run test:rules");
  rulesStep.skipKind = null;
  rulesStep.parsedCounts = parseVitestOutput(rulesStep.log);
}
writeFileSync(join(logsDir, "rules-tests.log"), rulesStep.log, "utf8");
steps.push(rulesStep);

// Step 8: Security Scan
console.log(`[verify] 8/8 Running repository security scan...`);
const secStep = runSecurityScan();
writeFileSync(join(logsDir, "security-scan.log"), secStep.log, "utf8");
steps.push(secStep);

// 8. Determine Overall Verdict & Exit Code
const failedSteps = steps.filter((s) => s.status === "FAIL");
const skippedSteps = steps.filter((s) => s.status === "SKIPPED");
const envSkippedSteps = skippedSteps.filter((s) => s.skipKind === "environment");
const passedSteps = steps.filter((s) => s.status === "PASS");

let overallVerdict = "PASS";
let exitCode = 0;
let incompleteReason = null;

if (failedSteps.length > 0) {
  overallVerdict = "FAIL";
  exitCode = 1;
} else if (envSkippedSteps.length > 0) {
  overallVerdict = "INCOMPLETE";
  exitCode = 2;
  const skippedNames = envSkippedSteps.map((s) => `'${s.name}'`).join(", ");
  incompleteReason = `Step(s) ${skippedNames} skipped due to missing environment prerequisites. Install Java 21+ and the Firebase CLI to execute offline emulator rules tests, then re-run.`;
} else {
  overallVerdict = "PASS";
  exitCode = 0;
}

console.log(`[verify] Gate execution finished: ${overallVerdict} (exit ${exitCode})`);

// 9. Generate report.md and report.json
const reportData = {
  runId,
  label: label || null,
  timestamp: {
    localFormatted: timeMeta.localFormatted,
    localIso: timeMeta.localIso,
    utcIso: timeMeta.utcIso,
  },
  git: gitMeta,
  environment: toolsMeta,
  verdict: overallVerdict,
  exitCode,
  incompleteReason: incompleteReason || null,
  summary: {
    totalSteps: steps.length,
    passed: passedSteps.length,
    failed: failedSteps.length,
    skipped: skippedSteps.length,
    envSkipped: envSkippedSteps.length,
  },
  steps: steps.map((s) => ({
    name: s.name,
    command: s.command,
    status: s.status,
    skipKind: s.skipKind || null,
    exitCode: s.exitCode,
    durationMs: s.durationMs,
    duration: s.durationStr,
    reason: s.reason,
    parsedCounts: s.parsedCounts || null,
    indexHtmlVerified: s.indexHtmlVerified ?? null,
    prodProjectId: s.prodProjectId || null,
    stagingProjectId: s.stagingProjectId || null,
  })),
  securityScan: {
    scannedFilesCount: secStep.scannedFilesCount,
    hits: secStep.hits || [],
  },
};

writeFileSync(join(runDir, "report.json"), JSON.stringify(reportData, null, 2), "utf8");

// Build report.md
let md = `# Quality Gate Verification Report: \`${runId}\`\n\n`;

md += `## Metadata\n\n`;
md += `| Attribute | Value |\n`;
md += `|---|---|\n`;
md += `| **Run ID** | \`${runId}\` |\n`;
md += `| **Local Time** | ${timeMeta.localFormatted} |\n`;
md += `| **UTC Time** | \`${timeMeta.utcIso}\` |\n`;
md += `| **Git Branch** | \`${gitMeta.branch}\` |\n`;
md += `| **Commit SHA** | \`${gitMeta.shortSha}\` |\n`;
md += `| **Working Tree** | ${gitMeta.isDirty ? `⚠️ Dirty (${gitMeta.dirtyCount} changed files)` : "Clean"} |\n`;
if (label) {
  md += `| **Label** | *${label}* |\n`;
}
md += `| **Bun Version** | \`${toolsMeta.bun}\` |\n`;
md += `| **Node Version** | \`${toolsMeta.node}\` |\n`;
md += `| **Java Runtime** | \`${toolsMeta.java}\` |\n`;
md += `| **Firebase CLI** | \`${toolsMeta.firebase}\` |\n\n`;

md += `## Overall Verdict: **${overallVerdict}**\n\n`;
if (overallVerdict === "PASS") {
  md += `All executed checks passed successfully.\n\n`;
} else if (overallVerdict === "INCOMPLETE") {
  md += `> [!IMPORTANT]\n> **Verification Incomplete**: ${incompleteReason}\n\n`;
} else {
  md += `> [!WARNING]\n> One or more verification steps encountered errors. Review the failure details below.\n\n`;
}

if (skippedSteps.length > 0) {
  md += `### Not Executed Steps (Skipped)\n\n`;
  skippedSteps.forEach((s) => {
    const flagNote = s.skipKind === "flag" ? " (explicitly skipped by flag)" : "";
    md += `- **\`${s.name}\`**: Skipped (${s.reason})${flagNote}\n`;
  });
  md += `\n`;
}

md += `## Steps Summary\n\n`;
md += `| Step | Status | Command | Duration | Exit Code | Details |\n`;
md += `|---|---|---|---|---|---|\n`;
for (const s of steps) {
  let icon = "✅ PASS";
  if (s.status === "FAIL") {
    icon = "❌ FAIL";
  } else if (s.status === "SKIPPED") {
    icon = s.skipKind === "flag" ? "⏭️ SKIPPED (by flag)" : "⚠️ SKIPPED (env)";
  }
  let details = "—";
  if (s.name === "build") {
    details = `index.html: ${s.indexHtmlVerified ? "verified" : "missing"}`;
  } else if (s.name === "env-isolation") {
    details =
      s.status === "PASS"
        ? `prod: ${s.prodProjectId}; staging: ${s.stagingProjectId}`
        : "isolation error";
  } else if (s.parsedCounts) {
    details = `Files: ${s.parsedCounts.testFiles}; Tests: ${s.parsedCounts.tests}`;
  } else if (s.name === "security-scan") {
    details = `Scanned ${s.scannedFilesCount} files; ${s.hits.length} hits`;
  } else if (s.reason) {
    details = s.reason;
  }
  md += `| **${s.name}** | ${icon} | \`${s.command}\` | ${s.durationStr} | \`${s.exitCode}\` | ${details} |\n`;
}
md += `\n`;

// Failure Details
if (failedSteps.length > 0) {
  md += `## Failure Details\n\n`;
  for (const s of failedSteps) {
    md += `### Step \`${s.name}\` (Exit Code: ${s.exitCode})\n\n`;
    md += `**Command:** \`${s.command}\`\n\n`;
    if (s.error) {
      md += `**Error:** ${s.error}\n\n`;
    }
    const tail = getLast60Lines(s.log);
    if (tail) {
      md += `\`\`\`text\n${tail}\n\`\`\`\n\n`;
    }
  }
}

// Security Scan Findings
md += `## Security Scan Details\n\n`;
if (secStep.hits && secStep.hits.length > 0) {
  md += `> [!CAUTION]\n> Forbidden credential patterns detected:\n\n`;
  for (const hit of secStep.hits) {
    md += `- \`${hit.file}:${hit.line}\` — Pattern: **\`${hit.pattern}\`**\n`;
  }
  md += `\n`;
} else {
  md += `✅ No legacy credentials, tokens, or private email domains found across ${secStep.scannedFilesCount} inspected files.\n\n`;
}

md += `---\n\n`;
md += `*How to read this*: Each quality check runs sequentially in an isolated process. Full step outputs are preserved in \`test-history/${runId}/logs/\`. Historical runs are indexed in \`test-history/INDEX.md\` and mirrored in \`test-history/LATEST.md\`.\n`;

writeFileSync(join(runDir, "report.md"), md, "utf8");

// 10. Update test-history/INDEX.md
const indexFile = join(testHistoryDir, "INDEX.md");
if (!existsSync(indexFile)) {
  let indexHead = `# Verification History Index\n\n`;
  indexHead += `| Run ID | Local Time | Branch | SHA | Dirty | Verdict | Failed | Skipped | Label |\n`;
  indexHead += `|---|---|---|---|---|---|---|---|---|\n`;
  writeFileSync(indexFile, indexHead, "utf8");
}

const failedStr = failedSteps.map((s) => s.name).join(", ") || "none";
const skippedStr = skippedSteps.map((s) => s.name).join(", ") || "none";
const dirtyStr = gitMeta.isDirty ? `dirty (${gitMeta.dirtyCount})` : "clean";

const indexRow = `| [${runId}](./${runId}/report.md) | ${timeMeta.localFormatted} | ${gitMeta.branch} | \`${gitMeta.shortSha}\` | ${dirtyStr} | **${overallVerdict}** | ${failedStr} | ${skippedStr} | ${label || "—"} |\n`;
writeFileSync(indexFile, indexRow, { flag: "a", encoding: "utf8" });

// 11. Overwrite test-history/LATEST.md
const latestFile = join(testHistoryDir, "LATEST.md");
copyFileSync(join(runDir, "report.md"), latestFile);

// 12. Optional retention pruning (--keep <N>)
function pruneRuns(historyDir, keepN) {
  if (!keepN || keepN < 1) return;
  try {
    const entries = readdirSync(historyDir, { withFileTypes: true });
    const runFolders = entries
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{6}_/.test(e.name))
      .map((e) => e.name)
      .sort();

    if (runFolders.length > keepN) {
      const toDelete = runFolders.slice(0, runFolders.length - keepN);
      for (const folder of toDelete) {
        rmSync(join(historyDir, folder), { recursive: true, force: true });
      }
    }
  } catch {
    /* ignore */
  }
}

if (keepCount) {
  pruneRuns(testHistoryDir, keepCount);
}

console.log(`[verify] Report written to: test-history/${runId}/report.md`);
console.log(`[verify] Latest mirrored to: test-history/LATEST.md`);

// Exit with 0 if PASS, 1 if FAIL, 2 if INCOMPLETE
process.exit(exitCode);
