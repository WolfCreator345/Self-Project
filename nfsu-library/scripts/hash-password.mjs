// Prints a bcrypt hash for ADMIN_PASSWORD_HASH. The password is never stored or logged.
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";

/** Read one line without echoing it (TTY), or plain lines when input is piped. */
function hiddenPrompt(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") {
          stdin.setRawMode(false);
          return reject(new Error("Cancelled"));
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function readPassword() {
  if (process.stdin.isTTY) {
    const a = await hiddenPrompt("New admin password: ");
    const b = await hiddenPrompt("Repeat password: ");
    return [a, b];
  }
  const lines = [];
  for await (const line of createInterface({ input: process.stdin })) {
    lines.push(line);
    if (lines.length === 2) break;
  }
  return [lines[0] ?? "", lines[1] ?? ""];
}

const [pw, again] = await readPassword();
if (pw !== again) {
  console.error("Passwords do not match.");
  process.exit(1);
}
if (pw.length < 10) {
  console.error("Use at least 10 characters.");
  process.exit(1);
}
const hash = await bcrypt.hash(pw, 12);
// Next.js expands "$VAR" inside .env files (even in quotes), which would corrupt
// the hash — so every "$" is escaped as "\$".
console.log("\nAdd this line to .env.local (copy it exactly, backslashes included):\n");
console.log(`ADMIN_PASSWORD_HASH=${hash.replaceAll("$", "\\$")}`);
