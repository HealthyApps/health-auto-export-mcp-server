import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as net from "net";

const HAE_HOST = process.env.HAE_HOST || "localhost";
const HAE_PORT = parseInt(process.env.HAE_PORT || "9000");
const DEFAULT_TIMEOUT = parseInt(process.env.HAE_TIMEOUT || "86400000");

const server = new McpServer({
  name: "Health Auto Export",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Helper function to send JSON-RPC request to Health Auto Export iOS app
async function sendRequest(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const requestId = Math.floor(Math.random() * 1000);
  const jsonrpcRequest = {
    jsonrpc: "2.0",
    id: requestId,
    method: "callTool",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const message = JSON.stringify(jsonrpcRequest);

  return new Promise((resolve) => {
    const client = new net.Socket();
    let responseData = "";
    let hasResponded = false;

    client.setTimeout(DEFAULT_TIMEOUT);

    client.connect(HAE_PORT, HAE_HOST, () => {
      client.write(message);
    });

    client.on("data", (data) => {
      responseData += data.toString();
    });

    client.on("end", () => {
      if (!hasResponded) {
        hasResponded = true;
        if (responseData) {
          try {
            const parsedResponse = JSON.parse(responseData);
            resolve({
              content: [
                { type: "text", text: JSON.stringify(parsedResponse, null, 2) },
              ],
            });
          } catch {
            resolve({
              content: [{ type: "text", text: responseData }],
            });
          }
        } else {
          resolve({
            content: [{ type: "text", text: "No response data received" }],
          });
        }
      }
    });

    client.on("error", (error) => {
      if (!hasResponded) {
        hasResponded = true;
        resolve({
          content: [
            {
              type: "text",
              text: `Failed to connect to Health Auto Export at ${HAE_HOST}:${HAE_PORT}: ${error.message}`,
            },
          ],
        });
      }
    });

    client.on("timeout", () => {
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        resolve({
          content: [
            {
              type: "text",
              text: `Request to Health Auto Export timed out after ${DEFAULT_TIMEOUT}ms`,
            },
          ],
        });
      }
    });

    client.on("close", () => {
      if (!hasResponded) {
        hasResponded = true;
        resolve({
          content: [
            {
              type: "text",
              text: `Connection to Health Auto Export closed unexpectedly`,
            },
          ],
        });
      }
    });
  });
}

// Health Metrics
server.tool(
  "get_health_metrics",
  "Get health metrics data (heart rate, steps, sleep, blood glucose, etc.) for a specified date range from Apple Health",
  {
    start: z
      .string()
      .describe("Start timestamp (e.g., '2025-01-18 00:00:00 -0500')"),
    end: z
      .string()
      .describe("End timestamp (e.g., '2025-01-18 23:59:59 -0500')"),
    metrics: z
      .string()
      .optional()
      .describe(
        "Metrics to export as comma-separated list (e.g., 'heart_rate,step_count'). Leave empty for all metrics."
      ),
    interval: z
      .string()
      .optional()
      .describe("Aggregation interval: 'minutes', 'hours', or 'days' (default: 'hours')"),
    aggregate: z
      .boolean()
      .optional()
      .describe("Whether to aggregate metrics (default: true)"),
  },
  async ({ start, end, metrics, interval, aggregate }) => {
    return sendRequest("health_metrics", {
      start,
      end,
      metrics: metrics || "",
      interval: interval || "hours",
      aggregate: aggregate ?? true,
    });
  }
);

// Workouts
server.tool(
  "get_workouts",
  "Get workout data (exercise sessions) for a specified date range from Apple Health",
  {
    start: z
      .string()
      .describe("Start timestamp (e.g., '2025-01-18 00:00:00 -0500')"),
    end: z
      .string()
      .describe("End timestamp (e.g., '2025-01-18 23:59:59 -0500')"),
    includeMetadata: z
      .boolean()
      .optional()
      .describe("Include health metric metadata (default: true)"),
    includeRoutes: z
      .boolean()
      .optional()
      .describe("Include GPS route data (default: false)"),
    metadataAggregation: z
      .string()
      .optional()
      .describe("Aggregation interval for metadata: 'seconds' or 'minutes' (default: 'minutes')"),
  },
  async ({ start, end, includeMetadata, includeRoutes, metadataAggregation }) => {
    return sendRequest("workouts", {
      start,
      end,
      includeMetadata: includeMetadata ?? true,
      includeRoutes: includeRoutes ?? false,
      metadataAggregation: metadataAggregation || "minutes",
    });
  }
);

// Symptoms
server.tool(
  "get_symptoms",
  "Get symptoms data for a specified date range from Apple Health",
  {
    start: z
      .string()
      .describe("Start timestamp (e.g., '2025-01-18 00:00:00 -0500')"),
    end: z
      .string()
      .describe("End timestamp (e.g., '2025-01-18 23:59:59 -0500')"),
  },
  async ({ start, end }) => {
    return sendRequest("symptoms", { start, end });
  }
);

// State of Mind
server.tool(
  "get_state_of_mind",
  "Get state of mind (mood/emotion) data for a specified date range from Apple Health (iOS 18+)",
  {
    start: z
      .string()
      .describe("Start timestamp (e.g., '2025-01-18 00:00:00 -0500')"),
    end: z
      .string()
      .describe("End timestamp (e.g., '2025-01-18 23:59:59 -0500')"),
  },
  async ({ start, end }) => {
    return sendRequest("state_of_mind", { start, end });
  }
);

// Medications
server.tool(
  "get_medications",
  "Get medications data for a specified date range from Apple Health (iOS 26+)",
  {
    start: z
      .string()
      .describe("Start timestamp (e.g., '2025-01-18 00:00:00 -0500')"),
    end: z
      .string()
      .describe("End timestamp (e.g., '2025-01-18 23:59:59 -0500')"),
  },
  async ({ start, end }) => {
    return sendRequest("medications", { start, end });
  }
);

// Cycle Tracking
server.tool(
  "get_cycle_tracking",
  "Get menstrual cycle tracking data for a specified date range from Apple Health",
  {
    start: z
      .string()
      .describe("Start timestamp (e.g., '2025-01-18 00:00:00 -0500')"),
    end: z
      .string()
      .describe("End timestamp (e.g., '2025-01-18 23:59:59 -0500')"),
  },
  async ({ start, end }) => {
    return sendRequest("cycle_tracking", { start, end });
  }
);

// ECG
server.tool(
  "get_ecg",
  "Get ECG (electrocardiogram) data for a specified date range from Apple Health",
  {
    start: z
      .string()
      .describe("Start timestamp (e.g., '2025-01-18 00:00:00 -0500')"),
    end: z
      .string()
      .describe("End timestamp (e.g., '2025-01-18 23:59:59 -0500')"),
  },
  async ({ start, end }) => {
    return sendRequest("ecg", { start, end });
  }
);

// Heart Notifications
server.tool(
  "get_heart_notifications",
  "Get heart notification events (irregular rhythm, high/low heart rate alerts) for a specified date range from Apple Health",
  {
    start: z
      .string()
      .describe("Start timestamp (e.g., '2025-01-18 00:00:00 -0500')"),
    end: z
      .string()
      .describe("End timestamp (e.g., '2025-01-18 23:59:59 -0500')"),
  },
  async ({ start, end }) => {
    return sendRequest("heart_notifications", { start, end });
  }
);

async function healthCheck(
  host: string,
  port: number,
  timeout: number = 5000
): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let hasResponded = false;

    client.setTimeout(timeout);

    client.connect(port, host, () => {
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        resolve(true);
      }
    });

    client.on("error", () => {
      if (!hasResponded) {
        hasResponded = true;
        resolve(false);
      }
    });

    client.on("timeout", () => {
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        resolve(false);
      }
    });
  });
}

async function main() {
  console.error(`Performing health check to ${HAE_HOST}:${HAE_PORT}...`);
  const isHealthy = await healthCheck(HAE_HOST, HAE_PORT);

  if (!isHealthy) {
    console.error(
      `Health check warning: Cannot connect to ${HAE_HOST}:${HAE_PORT}. Server will start anyway - ensure Health Auto Export iOS app is running with TCP server enabled.`
    );
  } else {
    console.error(
      `Health check passed: Successfully connected to ${HAE_HOST}:${HAE_PORT}`
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Health Auto Export MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
