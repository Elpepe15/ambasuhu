
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = readline.createInterface({
  input: stdin,
  output: stdout
});

const password = await rl.question(
  "Password perangkat baru: "
);

const hash = await bcrypt.hash(password, 12);

console.log("\nHASH PASSWORD:");
console.log(hash);

rl.close();
