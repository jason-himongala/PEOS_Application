const { packager } = require("@electron/packager");
const fs = require("fs");
const path = require("path");

async function run() {
  try {
    fs.rmSync("dist", { recursive: true, force: true });

    await packager({
      dir: ".",
      out: "dist",
      overwrite: true,
      platform: "win32",
      arch: "x64",
      name: "PEOS Application",
      icon: path.join(__dirname, "..", "public", "images", "icon.ico"),
      prune: true,
      ignore: [/^\/dist$/, /^\/\.git$/, /^\/node_modules\/\.cache$/],
    });

    console.log("Electron package created in dist/");
  } catch (error) {
    console.error("Packaging failed:", error);
    process.exit(1);
  }
}

run();
