import { EventEmitter } from "events";
import type { ClaudeCliMessage, ClaudeCliAssistant, ClaudeCliResult, ClaudeCliStreamEvent } from "../types/claude-cli.js";
import type { ClaudeModel } from "../adapter/openai-to-cli.js";
export interface SubprocessOptions {
    model: ClaudeModel;
    systemPrompt?: string | null;
    cwd?: string;
    timeout?: number;
}
export interface SubprocessEvents {
    message: (msg: ClaudeCliMessage) => void;
    content_delta: (msg: ClaudeCliStreamEvent) => void;
    assistant: (msg: ClaudeCliAssistant) => void;
    result: (result: ClaudeCliResult) => void;
    error: (error: Error) => void;
    close: (code: number | null) => void;
    raw: (line: string) => void;
}
export declare class ClaudeSubprocess extends EventEmitter {
    private process;
    private buffer;
    private timeoutId;
    private activityTimeout;
    private isKilled;
    /**
     * Start the Claude CLI subprocess with the given prompt
     */
    start(prompt: string, options: SubprocessOptions): Promise<void>;
    /**
     * Build CLI arguments array
     */
    private buildArgs;
    /**
     * Process the buffer and emit parsed messages
     */
    private processBuffer;
    /**
     * Reset activity timeout — called on each stdout data chunk.
     * If CLI goes silent for ACTIVITY_TIMEOUT ms, we kill it.
     */
    private resetActivityTimeout;
    /**
     * Clear all timeout timers
     */
    private clearTimeout;
    /**
     * Kill the subprocess
     */
    kill(signal?: NodeJS.Signals): void;
    /**
     * Check if the process is still running
     */
    isRunning(): boolean;
}
/**
 * Verify that Claude CLI is installed and accessible
 */
export declare function verifyClaude(): Promise<{
    ok: boolean;
    error?: string;
    version?: string;
}>;
/**
 * Check if Claude CLI is authenticated.
 * Claude Code stores credentials in the OS keychain, not a file.
 */
export declare function verifyAuth(): Promise<{
    ok: boolean;
    error?: string;
}>;
//# sourceMappingURL=manager.d.ts.map