import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["--test"], {
  env: {
    ...process.env,
    T_IMG_PAGES_BASE_URL: "http://127.0.0.1:8080",
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Unable to start the Pages test suite:", error.name);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
