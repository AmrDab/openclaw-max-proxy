/**
 * Plugin definition
 */
declare const claudeCodeCliPlugin: {
    id: string;
    name: string;
    description: string;
    configSchema: {
        type: "object";
        properties: {};
        additionalProperties: boolean;
    };
    register(api: any): void;
};
export default claudeCodeCliPlugin;
export { startServer, stopServer, getServer } from "./server/index.js";
export { ClaudeSubprocess, verifyClaude, verifyAuth } from "./subprocess/manager.js";
//# sourceMappingURL=index.d.ts.map