import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_INSTRUCTIONS } from './contract';
import { registerHostOutlineTools } from './registration';
import type { HostOutlineService } from './service';

/** Compatibility endpoint and main /mcp now use the same registration layer. */
export function createHostOutlineServer(service: HostOutlineService) {
    const server = new McpServer({ name: 'quotecore-host-roof-outline', version: '0.2.0' }, { instructions: SERVER_INSTRUCTIONS });
    registerHostOutlineTools(server, () => service);
    return server;
}
