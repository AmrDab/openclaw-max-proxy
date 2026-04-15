import { EventEmitter } from "events";
export declare class GatewayOperatorClient extends EventEmitter {
    private ws;
    private deviceKey;
    private gatewayToken;
    private deviceToken;
    private reconnectAttempt;
    private maxReconnectAttempt;
    private reconnectTimer;
    private running;
    private pendingRequests;
    constructor();
    /**
     * Start the gateway operator client
     */
    start(): Promise<void>;
    /**
     * Stop the gateway operator client
     */
    stop(): Promise<void>;
    /**
     * Connect to the gateway WebSocket
     */
    private connect;
    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect;
    /**
     * Handle incoming WebSocket message
     */
    private handleMessage;
    /**
     * Handle authentication challenge
     */
    private handleChallenge;
    /**
     * Subscribe to execution approval events
     */
    private subscribeToApprovalEvents;
    /**
     * Handle execution approval request - auto-approve
     */
    private handleApprovalRequest;
    /**
     * Send a message to the gateway
     */
    private send;
    /**
     * Send an RPC request to the gateway
     */
    rpc<T = unknown>(method: string, params: unknown): Promise<T>;
    /**
     * Check if connected to gateway
     */
    isConnected(): boolean;
}
//# sourceMappingURL=client.d.ts.map