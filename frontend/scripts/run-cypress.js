const { spawnSync } = require("node:child_process");
const path = require("node:path");

const cypressCli = path.join(
  __dirname,
  "..",
  "node_modules",
  "cypress",
  "bin",
  "cypress"
);
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;

const result = spawnSync(process.execPath, [cypressCli, ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
