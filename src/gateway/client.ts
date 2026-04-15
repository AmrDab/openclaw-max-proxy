/**
 * OpenClaw Gateway WebSocket Operator Client
 *
 * Connects to the OpenClaw gateway WebSocket and performs protocol v3 handshake.
 * Auto-resolves execution approval requests.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

const GATEWAY_URL = "ws://localhost:18789";
const CLIENT_ID = "openclaw-max-proxy";
const CLIENT_VERSION = "1.3.0";
const SCOPES = ["operator.read", "operator.write", "operator.approvals"];

interface DeviceKey {
    deviceId: string;
    publicKey: string;
    privateKey: string;
}

interface GatewayMessage {
    type: string;
    event?: string;
    id?: string;
    method?: string;
    params?: unknown;
    payload?: unknown;
    result?: unknown;
    error?: unknown;
}

interface ChallengePayload {
    nonce: string;
    ts: number;
}

/**
 * Base64url encode a buffer
 */
function base64urlEncode(buffer: Buffer): string {
    return buffer.toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

/**
 * Load gateway auth token from ~/.openclaw/openclaw.json
 */
function loadGatewayToken(): string | null {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    try {
        if (!fs.existsSync(configPath)) {
            return null;
        }
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        return config?.gateway?.auth?.token || null;
    } catch {
        return null;
    }
}

/**
 * Load or generate Ed25519 keypair for device identity
 */
function loadOrCreateDeviceKey(): DeviceKey {
    const keyPath = path.join(os.homedir(), ".openclaw", "proxy-device-key.json");

    try {
        if (fs.existsSync(keyPath)) {
            const stored = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
            if (stored.deviceId && stored.publicKey && stored.privateKey) {
                return stored;
            }
        }
    } catch {
        // Generate new key if loading fails
    }

    // Generate new Ed25519 keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "der" },
        privateKeyEncoding: { type: "pkcs8", format: "der" },
    });

    const deviceKey: DeviceKey = {
        deviceId: uuidv4(),
        publicKey: base64urlEncode(publicKey),
        privateKey: base64urlEncode(privateKey),
    };

    // Ensure directory exists
    const dir = path.dirname(keyPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(keyPath, JSON.stringify(deviceKey, null, 2));
    return deviceKey;
}

/**
 * Sign data with Ed25519 private key
 */
function signPayload(data: string, privateKeyBase64url: string): string {
    const privateKeyDer = Buffer.from(
        privateKeyBase64url.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
    );
    const privateKey = crypto.createPrivateKey({
        key: privateKeyDer,
        format: "der",
        type: "pkcs8",
    });
    const signature = crypto.sign(null, Buffer.from(data, "utf-8"), privateKey);
    return base64urlEncode(signature);
}

export class GatewayOperatorClient extends EventEmitter {
    private ws: WebSocket | null = null;
    private deviceKey: DeviceKey;
    private gatewayToken: string | null;
    private deviceToken: string | null = null;
    private reconnectAttempt = 0;
    private maxReconnectAttempt = 10;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private running = false;
    private pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

    constructor() {
        super();
        this.deviceKey = loadOrCreateDeviceKey();
        this.gatewayToken = loadGatewayToken();
    }

    /**
     * Start the gateway operator client
     */
    async start(): Promise<void> {
        if (this.running) {
            return;
        }
        this.running = true;

        if (!this.gatewayToken) {
            console.warn("[GatewayOperator] No gateway token found in ~/.openclaw/openclaw.json");
            console.warn("[GatewayOperator] Gateway operator will not connect");
            return;
        }

        this.connect();
    }

    /**
     * Stop the gateway operator client
     */
    async stop(): Promise<void> {
        this.running = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Connect to the gateway WebSocket
     */
    private connect(): void {
        if (!this.running) {
            return;
        }

        try {
            // Node 22+ has native WebSocket
            this.ws = new WebSocket(GATEWAY_URL);

            this.ws.onopen = () => {
                console.log("[GatewayOperator] Connected to gateway");
                this.reconnectAttempt = 0;
            };

            this.ws.onmessage = (event: MessageEvent) => {
                this.handleMessage(event.data.toString());
            };

            this.ws.onclose = () => {
                console.log("[GatewayOperator] Disconnected from gateway");
                this.scheduleReconnect();
            };

            this.ws.onerror = (error: Event) => {
                console.error("[GatewayOperator] WebSocket error:", error);
            };
        } catch (err) {
            console.error("[GatewayOperator] Failed to connect:", err);
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect(): void {
        if (!this.running) {
            return;
        }

        if (this.reconnectAttempt >= this.maxReconnectAttempt) {
            console.error("[GatewayOperator] Max reconnection attempts reached");
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30000);
        this.reconnectAttempt++;

        console.log(`[GatewayOperator] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: string): void {
        try {
            const msg: GatewayMessage = JSON.parse(data);

            // Handle challenge for authentication
            if (msg.type === "event" && msg.event === "connect.challenge") {
                this.handleChallenge(msg.payload as ChallengePayload);
                return;
            }

            // Handle hello-ok response
            if (msg.type === "res" && msg.id) {
                const pending = this.pendingRequests.get(msg.id);
                if (pending) {
                    this.pendingRequests.delete(msg.id);
                    if (msg.error) {
                        pending.reject(new Error(String(msg.error)));
                    } else {
                        pending.resolve(msg.result);
                    }
                }

                // Store device token from connect response
                if (msg.result && typeof msg.result === "object" && "deviceToken" in msg.result) {
                    this.deviceToken = (msg.result as { deviceToken: string }).deviceToken;
                    console.log("[GatewayOperator] Authenticated, subscribing to events");
                    this.subscribeToApprovalEvents();
                }
                return;
            }

            // Handle exec approval requested events
            if (msg.type === "event" && msg.event === "exec.approval.requested") {
                this.handleApprovalRequest(msg.payload);
                return;
            }

            // Emit other events
            this.emit("message", msg);
        } catch (err) {
            console.error("[GatewayOperator] Failed to parse message:", err);
        }
    }

    /**
     * Handle authentication challenge
     */
    private handleChallenge(payload: ChallengePayload): void {
        const { nonce, ts } = payload;

        // Create signed payload
        const signedPayload = JSON.stringify({
            deviceId: this.deviceKey.deviceId,
            clientId: CLIENT_ID,
            role: "operator",
            scopes: SCOPES,
            token: this.gatewayToken,
            nonce,
            platform: "windows",
            deviceFamily: "desktop",
        });

        const signature = signPayload(signedPayload, this.deviceKey.privateKey);

        // Send connect request
        const reqId = uuidv4();
        const connectReq: GatewayMessage = {
            type: "req",
            id: reqId,
            method: "connect",
            params: {
                minProtocol: 3,
                maxProtocol: 3,
                client: {
                    id: CLIENT_ID,
                    version: CLIENT_VERSION,
                    platform: "windows",
                    mode: "operator",
                },
                role: "operator",
                scopes: SCOPES,
                caps: [],
                commands: [],
                permissions: {},
                auth: {
                    token: this.gatewayToken,
                },
                device: {
                    id: this.deviceKey.deviceId,
                    publicKey: this.deviceKey.publicKey,
                    signature,
                    signedAt: Date.now(),
                    nonce,
                },
            },
        };

        this.send(connectReq);

        // Track the request
        this.pendingRequests.set(reqId, {
            resolve: () => {},
            reject: (err) => console.error("[GatewayOperator] Connect failed:", err),
        });
    }

    /**
     * Subscribe to execution approval events
     */
    private subscribeToApprovalEvents(): void {
        const reqId = uuidv4();
        const subscribeReq: GatewayMessage = {
            type: "req",
            id: reqId,
            method: "subscribe",
            params: {
                events: ["exec.approval.requested"],
            },
        };
        this.send(subscribeReq);
    }

    /**
     * Handle execution approval request - auto-approve
     */
    private handleApprovalRequest(payload: unknown): void {
        if (!payload || typeof payload !== "object") {
            return;
        }

        const { approvalId, sessionKey, command } = payload as {
            approvalId?: string;
            sessionKey?: string;
            command?: string;
        };

        if (!approvalId) {
            return;
        }

        console.log(`[GatewayOperator] Auto-resolving approval ${approvalId}: ${command || "unknown"}`);

        // Resolve the approval
        const reqId = uuidv4();
        const resolveReq: GatewayMessage = {
            type: "req",
            id: reqId,
            method: "exec.approval.resolve",
            params: {
                approvalId,
                sessionKey,
                approved: true,
            },
        };
        this.send(resolveReq);
    }

    /**
     * Send a message to the gateway
     */
    private send(msg: GatewayMessage): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    /**
     * Send an RPC request to the gateway
     */
    async rpc<T = unknown>(method: string, params: unknown): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error("Gateway not connected"));
                return;
            }

            const reqId = uuidv4();
            const req: GatewayMessage = {
                type: "req",
                id: reqId,
                method,
                params,
            };

            this.pendingRequests.set(reqId, {
                resolve: resolve as (v: unknown) => void,
                reject,
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(reqId)) {
                    this.pendingRequests.delete(reqId);
                    reject(new Error("RPC timeout"));
                }
            }, 30000);

            this.send(req);
        });
    }

    /**
     * Check if connected to gateway
     */
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}
