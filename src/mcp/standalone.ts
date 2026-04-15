#!/usr/bin/env node
/**
 * MCP Server Standalone Entry Point
 *
 * Starts the MCP server for stdio communication.
 * Usage: npx openclaw-mcp
 */
import { MCPServer } from "./server.js";

const server = new MCPServer();
server.start();
