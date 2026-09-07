import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const response = { jsonrpc: "2.0", id: 42, result: { samples: [] } };
const expectedAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

let tcpServer;
let client;

before(async () => {
  tcpServer = net.createServer((socket) => {
    socket.once("data", () => socket.end(JSON.stringify(response)));
  });
  await new Promise((resolve, reject) => {
    tcpServer.once("error", reject);
    tcpServer.listen(0, "127.0.0.1", resolve);
  });

  const address = tcpServer.address();
  assert(address && typeof address === "object");

  client = new Client({ name: "contract-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repositoryRoot, "dist/server.js")],
    cwd: repositoryRoot,
    env: {
      ...process.env,
      HAE_HOST: "127.0.0.1",
      HAE_PORT: String(address.port),
    },
    stderr: "pipe",
  });
  await client.connect(transport);
});

after(async () => {
  await client?.close();
  await new Promise((resolve, reject) =>
    tcpServer.close((error) => (error ? reject(error) : resolve()))
  );
});

test("stdio initialize and tools/list work while Health Auto Export is offline", async () => {
  const offlineClient = new Client({
    name: "offline-contract-test",
    version: "1.0.0",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(repositoryRoot, "dist/server.js")],
    cwd: repositoryRoot,
    env: {
      ...process.env,
      HAE_HOST: "127.0.0.1",
      HAE_PORT: "9000",
    },
    stderr: "pipe",
  });

  try {
    await offlineClient.connect(transport);
    const { tools } = await offlineClient.listTools();
    assert.ok(tools.length > 0, "the offline server must advertise its tools");

    const result = await offlineClient.callTool({
      name: "get_symptoms",
      arguments: {
        start: "2025-08-01 00:00:00 +0200",
        end: "2025-08-31 23:59:59 +0200",
      },
    });
    const [{ text }] = result.content;
    assert.match(
      text,
      /^Failed to connect to Health Auto Export at 127\.0\.0\.1:9000:/
    );
    assert.deepEqual(result.structuredContent, { text });
  } finally {
    await offlineClient.close();
  }
});

test("every advertised tool has an explicit output contract and annotations", async () => {
  const { tools } = await client.listTools();

  assert.ok(tools.length > 0, "the server must advertise at least one tool");
  for (const tool of tools) {
    assert.equal(tool.outputSchema?.type, "object", tool.name);
    assert.ok(
      Object.keys(tool.outputSchema?.properties ?? {}).length > 0,
      `${tool.name} must advertise a non-empty object output schema`
    );
    assert.deepEqual(tool.annotations, expectedAnnotations, tool.name);
  }
});

test("a representative read result matches its advertised output schema", async () => {
  const { tools } = await client.listTools();
  const tool = tools.find(({ name }) => name === "get_symptoms");
  assert(tool?.outputSchema);

  const result = await client.callTool({
    name: tool.name,
    arguments: {
      start: "2025-08-01 00:00:00 +0200",
      end: "2025-08-31 23:59:59 +0200",
    },
  });

  const expectedText = JSON.stringify(response, null, 2);

  assert.deepEqual(result.content, [{ type: "text", text: expectedText }]);
  assert.deepEqual(result.structuredContent, { text: expectedText });
  assert.deepEqual(Object.keys(tool.outputSchema.properties), ["text"]);
  assert.deepEqual(tool.outputSchema.required, ["text"]);
});
