/**
 * MCP Tool Definitions
 *
 * Tool definitions that map to OpenClaw gateway RPC calls.
 */

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, {
            type: string;
            description: string;
        }>;
        required?: string[];
    };
}

export const MCP_TOOLS: MCPTool[] = [
    {
        name: "openclaw_send_agent_message",
        description: "Send a message to an OpenClaw agent session. The message will be processed by the active Claude agent.",
        inputSchema: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "The message to send to the agent session",
                },
                sessionKey: {
                    type: "string",
                    description: "Optional session key to target a specific session. If not provided, uses the main session.",
                },
            },
            required: ["message"],
        },
    },
    {
        name: "openclaw_exec",
        description: "Execute a shell command via the OpenClaw agent. The command will be run in the agent's working directory.",
        inputSchema: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The shell command to execute",
                },
                cwd: {
                    type: "string",
                    description: "Optional working directory for the command",
                },
            },
            required: ["command"],
        },
    },
    {
        name: "openclaw_web_search",
        description: "Perform a web search via the OpenClaw agent. Results will be returned as text.",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query",
                },
            },
            required: ["query"],
        },
    },
    {
        name: "openclaw_browser_open",
        description: "Open a URL in the browser via the OpenClaw agent. Useful for viewing web pages or documentation.",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The URL to open in the browser",
                },
            },
            required: ["url"],
        },
    },
];

/**
 * Map tool name to gateway RPC method and message formatter
 */
export function getToolHandler(toolName: string): {
    method: string;
    formatParams: (args: Record<string, unknown>) => unknown;
} | null {
    switch (toolName) {
        case "openclaw_send_agent_message":
            return {
                method: "sessions.send",
                formatParams: (args) => ({
                    sessionKey: args.sessionKey || "main",
                    message: args.message,
                }),
            };

        case "openclaw_exec":
            return {
                method: "sessions.send",
                formatParams: (args) => ({
                    sessionKey: "main",
                    message: `Please execute this command: ${args.command}${args.cwd ? ` (in directory: ${args.cwd})` : ""}`,
                }),
            };

        case "openclaw_web_search":
            return {
                method: "sessions.send",
                formatParams: (args) => ({
                    sessionKey: "main",
                    message: `Please search the web for: ${args.query}`,
                }),
            };

        case "openclaw_browser_open":
            return {
                method: "sessions.send",
                formatParams: (args) => ({
                    sessionKey: "main",
                    message: `Please open this URL in the browser: ${args.url}`,
                }),
            };

        default:
            return null;
    }
}
