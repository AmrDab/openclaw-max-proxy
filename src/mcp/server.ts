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

interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: string | number;
    method: string;
    params?: unknown;
}

interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

export class MCPServer {
    private gateway: GatewayOperatorClient;
    private rl: readline.Interface | null = null;

    constructor() {
        this.gateway = new GatewayOperatorClient();
    }

    /**
     * Start the MCP server
     */
    async start(): Promise<void> {
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
    private async handleLine(line: string): Promise<void> {
        if (!line.trim()) {
            return;
        }

        let request: JsonRpcRequest;
        try {
            request = JSON.parse(line);
        } catch {
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
        } catch (err) {
            this.sendError(
                request.id,
                -32603,
                err instanceof Error ? err.message : "Internal error"
            );
        }
    }

    /**
     * Handle an MCP method
     */
    private async handleMethod(method: string, params: unknown): Promise<unknown> {
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
    private handleInitialize(_params: unknown): unknown {
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
    private handleToolsList(): unknown {
        return {
            tools: MCP_TOOLS,
        };
    }

    /**
     * Handle tools/call method
     */
    private async handleToolsCall(params: unknown): Promise<unknown> {
        if (!params || typeof params !== "object") {
            throw new Error("Invalid params");
        }

        const { name, arguments: args } = params as {
            name: string;
            arguments?: Record<string, unknown>;
        };

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
        } catch (err) {
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
    private sendResult(id: string | number, result: unknown): void {
        const response: JsonRpcResponse = {
            jsonrpc: "2.0",
            id,
            result,
        };
        this.send(response);
    }

    /**
     * Send a JSON-RPC error
     */
    private sendError(id: string | number | null, code: number, message: string): void {
        const response: JsonRpcResponse = {
            jsonrpc: "2.0",
            id,
            error: { code, message },
        };
        this.send(response);
    }

    /**
     * Send a response to stdout
     */
    private send(response: JsonRpcResponse): void {
        process.stdout.write(JSON.stringify(response) + "\n");
    }
}
