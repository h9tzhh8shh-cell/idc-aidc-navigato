// IDC/AIDC adaptation, 2026-10-04: metadata, attribution, and fresh manual data.
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "url";
import fs from "fs";
import path from "path";
import process from "process";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const { version } = JSON.parse(fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"));

function writeVersionPlugin() {
  return {
    name: "write-version",
    closeBundle() {
      fs.writeFileSync("dist/VERSION", version);
      fs.copyFileSync("LICENSE", "dist/LICENSE");
      fs.copyFileSync("NOTICE", "dist/NOTICE");
      fs.writeFileSync(
        "dist/BUILD_INFO.json",
        JSON.stringify(
          {
            application: "IDC/AIDC 与算力租赁数据导航",
            upstream: "https://github.com/bastienwirtz/homer",
            upstreamTag: "v26.08.3",
            upstreamCommit: "daa017dfe1ea8d0875697aede091319b6134bb4b",
            data: "assets/catalog.json",
          },
          null,
          2,
        ),
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "",
  build: {
    assetsDir: "resources",
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    writeVersionPlugin(),
    // Custom plugin to serve dummy-data JSON files without sourcemap injection
    {
      name: "dummy-data-json-handler",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/dummy-data/")) {
            // Remove query parameters from URL to get the actual file path
            const urlWithoutQuery = req.url.split("?")[0];
            const filePath = path.join(process.cwd(), urlWithoutQuery);

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.end(fs.readFileSync(filePath, "utf8"));
              return;
            }
          }
          next();
        });
      },
    },
    react(),
    VitePWA({
      // Manual catalog maintenance requires fresh builds; unregister Homer caches.
      selfDestroying: true,
      injectRegister: null,
      registerType: "autoUpdate",
      useCredentials: true,
      manifestFilename: "assets/manifest.json",
      manifest: {
        name: "IDC/AIDC 与算力租赁数据导航",
        short_name: "算力研究导航",
        description: "人工维护的行业研究来源目录",
        theme_color: "#11233d",
        start_url: "../",
        scope: "../",
        icons: [
          {
            src: "./icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "./icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        navigateFallback: null,
        globIgnores: ["**/catalog.json", "**/*.yml*"],
      },
    }),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./node_modules", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
});
