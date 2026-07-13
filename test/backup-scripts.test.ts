import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

async function executable(file: string, body: string) {
  await writeFile(file, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  await chmod(file, 0o755);
}

test("backup manifest is portable, excludes itself and restore uses the configured database", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "clinicnova-backup-test-"));
  const bin = path.join(root, "bin");
  const backupRoot = path.join(root, "backups");
  const walRoot = path.join(root, "wal");
  const psqlLog = path.join(root, "psql.log");
  await mkdir(bin);
  await executable(path.join(bin, "pg_basebackup"), `for arg in "$@"; do case "$arg" in --pgdata=*) dir="\${arg#*=}";; esac; done\nmkdir -p "$dir"\nprintf '18' > "$dir/PG_VERSION"`);
  await executable(path.join(bin, "pg_dump"), `for arg in "$@"; do case "$arg" in --file=*) file="\${arg#*=}";; esac; done\nprintf 'dump' > "$file"`);
  await executable(path.join(bin, "rclone"), "exit 0");
  await executable(path.join(bin, "pg_ctl"), "exit 0");
  await executable(path.join(bin, "psql"), `printf '%s\\n' "$*" > "$PSQL_LOG"`);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, DATABASE_URL: "postgresql://test:test@db/testdb", BACKUP_ROOT: backupRoot, WAL_ARCHIVE_ROOT: walRoot, BACKUP_REMOTE: "remote:test", RESTORE_TEST_DATABASE: "tenant_database", PSQL_LOG: psqlLog };
  try {
    execFileSync("bash", ["ops/postgres/backup.sh"], { cwd: process.cwd(), env, stdio: "pipe" });
    const baseFolders = await import("node:fs/promises").then(({ readdir }) => readdir(path.join(backupRoot, "base")));
    assert.equal(baseFolders.length, 1);
    const backup = path.join(backupRoot, "base", baseFolders[0]);
    const manifest = await readFile(path.join(backup, "SHA256SUMS"), "utf8");
    assert.doesNotMatch(manifest, /SHA256SUMS/);
    assert.doesNotMatch(manifest, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    execFileSync("sha256sum", ["--check", "SHA256SUMS"], { cwd: backup, stdio: "pipe" });

    execFileSync("bash", ["ops/postgres/restore-test.sh", backup], { cwd: process.cwd(), env, stdio: "pipe" });
    assert.match(await readFile(psqlLog, "utf8"), /-d tenant_database/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("WAL archiving is idempotent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "clinicnova-wal-test-"));
  const source = path.join(root, "source");
  const archive = path.join(root, "archive");
  try {
    await writeFile(source, "first");
    execFileSync("bash", ["ops/postgres/archive-wal.sh", source, "000000010000000000000001"], { cwd: process.cwd(), env: { ...process.env, WAL_ARCHIVE_ROOT: archive } });
    await writeFile(source, "changed");
    execFileSync("bash", ["ops/postgres/archive-wal.sh", source, "000000010000000000000001"], { cwd: process.cwd(), env: { ...process.env, WAL_ARCHIVE_ROOT: archive } });
    assert.equal(await readFile(path.join(archive, "000000010000000000000001"), "utf8"), "first");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
