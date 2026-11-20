// npm run db:backup — copies the live database to backups/<date>/ on this computer.
//
// Supabase's free plan keeps no backups you can download, so run this
// regularly (for example every Sunday). It needs Docker Desktop running and
// `npx supabase login` + `npx supabase link` done once (see README).
//
// The files contain customers' personal data. backups/ is in .gitignore:
// never commit them (this repository is public) and keep them somewhere safe.
// Photos and receipts in Storage are not included.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
// Always <project>/backups, wherever this is run from, so it stays inside the
// gitignored folder. The Supabase CLI runs from the project folder and gets a
// path relative to it: the project's own path may contain spaces, which a
// Windows shell would split into separate arguments.
const root = fileURLToPath(new URL("../", import.meta.url));
const dir = join("backups", stamp);
mkdirSync(join(root, dir), { recursive: true });

const steps = [
  ["roles.sql", ["--role-only"]],
  ["schema.sql", []],
  ["data.sql", ["--data-only", "--use-copy"]],
];

for (const [file, flags] of steps) {
  const target = join(dir, file);
  console.log(`Saving ${target} …`);
  const result = spawnSync("npx", ["supabase", "db", "dump", "--linked", ...flags, "-f", target], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\nBackup failed while saving ${file}. Is Docker Desktop running, and is the project linked?`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nDone. Backup saved in ${join(root, dir)}`);
