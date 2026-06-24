import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

function extensionPostbuild(): Plugin {
  return {
    name: "extension-postbuild",
    closeBundle() {
      const dist = resolve(__dirname, "dist");
      const nestedPopup = resolve(dist, "src/popup/popup.html");
      if (existsSync(nestedPopup)) {
        const html = readFileSync(nestedPopup, "utf8").replace(/\.\.\/\.\.\//g, "./");
        writeFileSync(resolve(dist, "popup.html"), html);
        rmSync(resolve(dist, "src"), { recursive: true, force: true });
      }
      const nestedIcons = resolve(dist, "icons/icons");
      if (existsSync(nestedIcons)) {
        rmSync(nestedIcons, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    extensionPostbuild(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "public/icons", dest: "icons" },
        { src: "src/content/content.css", dest: ".", rename: "content.css" },
      ],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
