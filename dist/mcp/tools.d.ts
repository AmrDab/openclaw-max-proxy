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
export declare const MCP_TOOLS: MCPTool[];
/**
 * Map tool name to gateway RPC method and message formatter
 */
export declare function getToolHandler(toolName: string): {
    method: string;
    formatParams: (args: Record<string, unknown>) => unknown;
} | null;
//# sourceMappingURL=tools.d.ts.map