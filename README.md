[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/healthyapps-health-auto-export-mcp-server-badge.png)](https://mseep.ai/app/healthyapps-health-auto-export-mcp-server)

# Health Auto Export

This project provides examples of how to work with the TCP server in [Health Auto Export](https://apple.co/3iqbU2d) app for iPhone/iPad.

You can make queries to the server directly over TCP, or the project can be connected to LLMs, such as Claude app for desktop, via MCP.

In the `/docs` folder you will find more detailed instructions.

- [How to use the TCP server](docs/tcp-server.md)

# Running This Project

## Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **Health Auto Export app**: Installed on iPhone/iPad with Premium access
- **Network access**: Your computer and mobile device must be on the same Wi-Fi network

## Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd health-auto-export-mcp-server
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure `.env` file**:

   - Copy the `.env.example` file and rename it to `.env`
   - Set the appropriate value for `HAE_HOST` (your device IP address)

4. **Build the project**:

   ```bash
   npm run build
   ```

5. **Run dev server**:

   ```bash
   npm run dev
   ```

## Usage

### TCP

`client_example.ts` provides an example of a client that connects to the Health Auto Export server over TCP.

1. Build the project using `npm run build`
2. Run the client using `node ./dist/client_example.js`
3. Expand on the code to build your own integration

### Configure Claude MCP

For MCP tool names and breaking changes in 1.0.0, see `CHANGELOG.md`. Implementation lives in `src/server.ts`.

1. Build the project using `npm run build`
2. Navigate to `Settings -> Developer -> Edit Config`
3. This should open `claude_desktop_config.json`
4. Add the MCP server details as shown below, pointing to the correct path on disk where you have set up this project:

   ```json
   {
     "mcpServers": {
       "health_auto_export": {
         "command": "node",
         "args": ["/Users/username/Desktop/hae-mcp/dist/server.js"]
       }
     }
   }
   ```

5. Restart Claude Desktop
6. Keep in mind Claude's context window limitations when using MCP. This means data may need to be aggregated appropriately in order to process requests.
7. Further information on Claude Desktop MCP configuration

   - [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)
