import { spawn } from "child_process";
import electronBinary from "electron";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

if (hasFlag("--devtools")) env.ELECTRON_DEVTOOLS = "1";
if (hasFlag("--smoke")) env.ELECTRON_SMOKE = "1";
if (hasFlag("--no-gpu")) env.ELECTRON_NO_GPU = "1";

const child = spawn(electronBinary, ["."], {
  stdio: "inherit",
  env,
  windowsHide: true
});

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

