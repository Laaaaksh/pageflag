import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions[]} */
const configs = [
  {
    // The snippet a customer pastes onto their site. Kept dependency-free and
    // tiny - it can render markers and the launcher button on every page load.
    entryPoints: ["src/loader.ts"],
    outfile: "dist/widget.js",
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2020",
    sourcemap: true,
  },
  {
    // The click-to-pin flow (html2canvas included) - only fetched once someone
    // actually opens the feedback button, via a dynamic import() from loader.ts.
    entryPoints: ["src/pin-editor.ts"],
    outfile: "dist/pin-editor.js",
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2020",
    sourcemap: true,
  },
];

if (watch) {
  const contexts = await Promise.all(configs.map((c) => esbuild.context(c)));
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("watching widget bundles for changes...");
} else {
  const results = await Promise.all(configs.map((c) => esbuild.build({ ...c, metafile: true })));
  for (const result of results) {
    for (const [file, info] of Object.entries(result.metafile.outputs)) {
      if (file.endsWith(".map")) continue;
      console.log(`built ${file} (${(info.bytes / 1024).toFixed(1)}kb)`);
    }
  }
}
