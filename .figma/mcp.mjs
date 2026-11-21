// Minimal MCP client for Figma Desktop's Dev Mode server (SSE transport).
// Usage: node .figma/mcp.mjs <method> [json-params]
const BASE = "http://127.0.0.1:3845";

setTimeout(() => {
  console.error("hard timeout");
  process.exit(2);
}, 20000).unref();

const method = process.argv[2] ?? "tools/list";
const params = process.argv[3] ? JSON.parse(process.argv[3]) : {};

const res = await fetch(`${BASE}/sse`, { headers: { Accept: "text/event-stream" } });
if (!res.ok) {
  console.error(`sse failed: ${res.status}`);
  process.exit(1);
}
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let endpoint = null;
let nextId = 1;
const waiting = new Map();

function handleMessage(text) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }
  if (!msg.id) console.error("notification", text.slice(0, 160));
  if (msg.id && waiting.has(msg.id)) {
    const { resolve, reject } = waiting.get(msg.id);
    waiting.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
}

async function pump() {
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      const data = [];
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trim());
      }
      if (event === "endpoint") endpoint = new URL(data.join("\n"), BASE).toString();
      else if (data.length) handleMessage(data.join("\n"));
    }
  }
}

const pumping = pump();

for (let i = 0; i < 100 && !endpoint; i++) await new Promise((r) => setTimeout(r, 50));
if (!endpoint) {
  console.error("no endpoint from server");
  process.exit(1);
}
console.error("endpoint", endpoint);

async function post(body) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`post failed: ${r.status} ${await r.text()}`);
}

function rpc(name, rpcParams) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    post({ jsonrpc: "2.0", id, method: name, params: rpcParams }).catch(reject);
    setTimeout(() => {
      if (waiting.has(id)) {
        waiting.delete(id);
        reject(new Error(`${name} timed out`));
      }
    }, 120000);
  });
}

await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "codebuff", version: "0.1.0" },
});
await post({ jsonrpc: "2.0", method: "notifications/initialized" });

try {
  const isListing = method === "tools/list" || method === "resources/list" || method === "prompts/list";
  const result = isListing
    ? await rpc(method, params)
    : await rpc("tools/call", { name: method, arguments: params });
  const fs = await import("node:fs/promises");
  await fs.mkdir(".figma/out", { recursive: true });
  await fs.writeFile(".figma/out/last.json", JSON.stringify(result, null, 2));

  const content = Array.isArray(result?.content) ? result.content : [];
  const texts = [];
  for (const [i, item] of content.entries()) {
    if (item.type === "image" && item.data) {
      const buf = Buffer.from(item.data, "base64");
      const path = `.figma/out/${method}-${i}.png`;
      await fs.writeFile(path, buf);
      console.log(`image ${path} (${buf.length} bytes)`);
    } else if (item.type === "text") {
      texts.push(item.text);
    } else {
      texts.push(JSON.stringify(item).slice(0, 400));
    }
  }
  if (texts.length) console.log(texts.join("\n---\n"));
  else if (!content.length) console.log(JSON.stringify(result, null, 2).slice(0, 12000));
} catch (err) {
  console.error(String(err));
  process.exitCode = 1;
}

await reader.cancel().catch(() => {});
void pumping;
process.exit(process.exitCode ?? 0);
