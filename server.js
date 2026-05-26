const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const host = "0.0.0.0";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".sql": "text/plain; charset=utf-8",
};

const server = http.createServer((request, response) => {
  const requestedPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const requestedFile = safePath === "/" ? "index.html" : safePath;
  let filePath = path.join(root, requestedFile);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      const extensionlessHtmlPath = `${filePath}.html`;
      if (!path.extname(filePath) && extensionlessHtmlPath.startsWith(root)) {
        fs.readFile(extensionlessHtmlPath, (htmlError, htmlContent) => {
          if (htmlError) {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Page not found. Try /register.html, /login.html, /dashboard.html, /insurance.html, /customers.html, or /settings.html.");
            return;
          }

          response.writeHead(200, { "Content-Type": mimeTypes[".html"] });
          response.end(htmlContent);
        });
        return;
      }

      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Page not found. Try /register.html, /login.html, /dashboard.html, /insurance.html, /customers.html, or /settings.html.");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  });
});

server.listen(port, host, () => {
  console.log(`Vehicle Insurance Manager running at http://localhost:${port}`);
  console.log(`For mobile testing, open http://YOUR-LAPTOP-IP:${port}/login.html`);
  console.log(`Serving files from ${root}`);
  console.log(`Open http://localhost:${port}/register.html`);
});
