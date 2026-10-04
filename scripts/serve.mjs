// Local HTTP preview of the static build; no dependencies or runtime API.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(process.argv[2] || "dist");
const port = Number(process.argv[3] || 5050);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};
await stat(path.join(root, "index.html"));
http
  .createServer(async (req, res) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        root,
        `.${pathname.endsWith("/") ? `${pathname}index.html` : pathname}`,
      );
      const relative = path.relative(root, file);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Content-Length": body.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res
        .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
        .end("File not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(
      `Local preview: http://127.0.0.1:${port}/\nRoot: ${root}\nPress Ctrl+C to stop.`,
    ),
  );
