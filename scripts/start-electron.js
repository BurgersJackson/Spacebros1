const { spawn } = require("child_process");

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

if (hasFlag("--devtools")) env.ELECTRON_DEVTOOLS = "1";
if (hasFlag("--smoke")) env.ELECTRON_SMOKE = "1";
if (hasFlag("--no-gpu")) env.ELECTRON_NO_GPU = "1";

const electronBinary = require("electron");
const child = spawn(electronBinary, ["."], { stdio: "inherit", env });

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

