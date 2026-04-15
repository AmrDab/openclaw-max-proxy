/**
 * MCP (Model Context Protocol) stdio Server
 *
 * Implements JSON-RPC 2.0 over newline-delimited stdio.
 * Protocol version: 2024-11-05
 */
import * as readline from "readline";
import { GatewayOperatorClient } from "../gateway/client.js";
import { MCP_TOOLS, getToolHandler } from "./tools.js";
const MCP_VERSION = "2024-11-05";
const SERVER_NAME = "openclaw-max-proxy";
const SERVER_VERSION = "1.3.0";
export class MCPServer {
    gateway;
    rl = null;
    constructor() {
        this.gateway = new GatewayOperatorClient();
    }
    /**
     * Start the MCP server
     */
    async start() {
        // Start gateway connection
        await this.gateway.start();
        // Set up stdin reader
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        // Process incoming lines
        this.rl.on("line", (line) => {
            this.handleLine(line);
        });
        this.rl.on("close", () => {
            this.gateway.stop();
            process.exit(0);
        });
        // Prevent stdout from adding extra newlines
        process.stdout.setDefaultEncoding("utf-8");
    }
    /**
     * Handle an incoming JSON-RPC line
     */
    async handleLine(line) {
        if (!line.trim()) {
            return;
        }
        let request;
        try {
            request = JSON.parse(line);
        }
        catch {
            this.sendError(null, -32700, "Parse error");
            return;
        }
        if (request.jsonrpc !== "2.0" || !request.method) {
            this.sendError(request.id || null, -32600, "Invalid Request");
            return;
        }
        try {
            const result = await this.handleMethod(request.method, request.params);
            this.sendResult(request.id, result);
        }
        catch (err) {
            this.sendError(request.id, -32603, err instanceof Error ? err.message : "Internal error");
        }
    }
    /**
     * Handle an MCP method
     */
    async handleMethod(method, params) {
        switch (method) {
            case "initialize":
                return this.handleInitialize(params);
            case "tools/list":
                return this.handleToolsList();
            case "tools/call":
                return this.handleToolsCall(params);
            default:
                throw new Error(`Method not found: ${method}`);
        }
    }
    /**
     * Handle initialize method
     */
    handleInitialize(_params) {
        return {
            protocolVersion: MCP_VERSION,
            capabilities: {
                tools: {},
            },
            serverInfo: {
                name: SERVER_NAME,
                version: SERVER_VERSION,
            },
        };
    }
    /**
     * Handle tools/list method
     */
    handleToolsList() {
        return {
            tools: MCP_TOOLS,
        };
    }
    /**
     * Handle tools/call method
     */
    async handleToolsCall(params) {
        if (!params || typeof params !== "object") {
            throw new Error("Invalid params");
        }
        const { name, arguments: args } = params;
        if (!name) {
            throw new Error("Tool name required");
        }
        const handler = getToolHandler(name);
        if (!handler) {
            throw new Error(`Unknown tool: ${name}`);
        }
        // Check gateway connection
        if (!this.gateway.isConnected()) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Gateway not connected. Please ensure OpenClaw gateway is running.",
                    },
                ],
                isError: true,
            };
        }
        try {
            const rpcParams = handler.formatParams(args || {});
            const result = await this.gateway.rpc(handler.method, rpcParams);
            return {
                content: [
                    {
                        type: "text",
                        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
                    },
                ],
                isError: true,
            };
        }
    }
    /**
     * Send a JSON-RPC result
     */
    sendResult(id, result) {
        const response = {
            jsonrpc: "2.0",
            id,
            result,
        };
        this.send(response);
    }
    /**
     * Send a JSON-RPC error
     */
    sendError(id, code, message) {
        const response = {
            jsonrpc: "2.0",
            id,
            error: { code, message },
        };
        this.send(response);
    }
    /**
     * Send a response to stdout
     */
    send(response) {
        process.stdout.write(JSON.stringify(response) + "\n");
    }
}
//# sourceMappingURL=server.js.map