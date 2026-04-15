export declare class MCPServer {
    private gateway;
    private rl;
    constructor();
    /**
     * Start the MCP server
     */
    start(): Promise<void>;
    /**
     * Handle an incoming JSON-RPC line
     */
    private handleLine;
    /**
     * Handle an MCP method
     */
    private handleMethod;
    /**
     * Handle initialize method
     */
    private handleInitialize;
    /**
     * Handle tools/list method
     */
    private handleToolsList;
    /**
     * Handle tools/call method
     */
    private handleToolsCall;
    /**
     * Send a JSON-RPC result
     */
    private sendResult;
    /**
     * Send a JSON-RPC error
     */
    private sendError;
    /**
     * Send a response to stdout
     */
    private send;
}
//# sourceMappingURL=server.d.ts.map