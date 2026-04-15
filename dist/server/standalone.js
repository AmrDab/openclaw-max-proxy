#!/usr/bin/env node
/**
 * Standalone server for testing without OpenClaw
 *
 * Usage:
 *   npm run start
 *   # or
 *   node dist/server/standalone.js [port]
 *
 * Flags:
 *   --gateway    Also start the OpenClaw Gateway Operator client.
 *                This connects to ws://localhost:18789 and auto-resolves
 *                execution approval requests. Requires gateway token in
 *                ~/.openclaw/openclaw.json (field: gateway.auth.token)
 */
import { startServer, stopServer } from "./index.js";
import { verifyClaude, verifyAuth } from "../subprocess/manager.js";
import { GatewayOperatorClient } from "../gateway/client.js";
const DEFAULT_PORT = 3456;
let gatewayClient = null;
async function main() {
    console.log("Claude Code CLI Provider - Standalone Server");
    console.log("============================================\n");
    // Parse command line arguments
    const args = process.argv.slice(2);
    const gatewayFlag = args.includes("--gateway");
    const portArg = args.find((arg) => !arg.startsWith("--"));
    // Parse port from command line
    const port = parseInt(portArg || String(DEFAULT_PORT), 10);
    if (isNaN(port) || port < 1 || port > 65535) {
        console.error(`Invalid port: ${portArg}`);
        process.exit(1);
    }
    // Verify Claude CLI
    console.log("Checking Claude CLI...");
    const cliCheck = await verifyClaude();
    if (!cliCheck.ok) {
        console.error(`Error: ${cliCheck.error}`);
        process.exit(1);
    }
    console.log(`  Claude CLI: ${cliCheck.version || "OK"}`);
    // Verify authentication
    console.log("Checking authentication...");
    const authCheck = await verifyAuth();
    if (!authCheck.ok) {
        console.error(`Error: ${authCheck.error}`);
        console.error("Please run: claude auth login");
        process.exit(1);
    }
    console.log("  Authentication: OK\n");
    // Start server
    try {
        await startServer({ port });
        console.log("\nServer ready. Test with:");
        console.log(`  curl -X POST http://localhost:${port}/v1/chat/completions \\`);
        console.log(`    -H "Content-Type: application/json" \\`);
        console.log(`    -d '{"model": "claude-sonnet-4", "messages": [{"role": "user", "content": "Hello!"}]}'`);
        console.log("\nPress Ctrl+C to stop.\n");
        // Start gateway operator if --gateway flag is provided
        if (gatewayFlag) {
            console.log("Starting Gateway Operator client...");
            gatewayClient = new GatewayOperatorClient();
            await gatewayClient.start();
            console.log("  Gateway Operator: Started (auto-resolving approvals)\n");
        }
    }
    catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
    // Handle graceful shutdown
    const shutdown = async () => {
        console.log("\nShutting down...");
        if (gatewayClient) {
            await gatewayClient.stop();
        }
        await stopServer();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
//# sourceMappingURL=standalone.js.map