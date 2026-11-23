
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = readline.createInterface({
  input: stdin,
  output: stdout
});

const password = await rl.question(
  "Masukkan password perangkat: "
);

const hash = await bcrypt.hash(password, 12);

console.log("\nPassword hash:");
console.log(hash);

rl.close();
