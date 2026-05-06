import { createServer } from "node:http";

const port = Number(process.env.PORT || 3001);

createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true }));
}).listen(port, "127.0.0.1", () => {
  console.log(`API listening on ${port}`);
});
