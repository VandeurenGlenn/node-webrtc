import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const builtins = new Set(
  builtinModules.concat(builtinModules.map((name) => `node:${name}`)),
);

function isExternal(id) {
  const srcRoot = path.resolve(__dirname, "src");
  if (id.startsWith("src/") || id.startsWith(srcRoot)) {
    return false;
  }
  if (builtins.has(id)) {
    return true;
  }
  if (id.startsWith(".") || id.startsWith("/") || id.startsWith("\u0000")) {
    return false;
  }
  return true;
}

export default {
  input: "src/lib/index.ts",
  output: {
    dir: "lib",
    format: "esm",
    exports: "auto",
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: "src/lib",
  },
  external: isExternal,
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
    }),
  ],
};
