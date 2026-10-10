import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HOST_OUTLINE_TOOLS } from './contract';
import { inputShapes, outputShape } from './schemas';
import { toolError, type HostOutlineService } from './service';
import { RESOURCE_URI } from './types';
import { widgetHtml } from './widget';

/** Register on the EXISTING server, without replacing any legacy handlers. Lazy service creation
 * means listing tools needs neither a storage request nor a service-role credential. */
export function registerHostOutlineTools(server: McpServer, getService: () => HostOutlineService): void {
    for (const descriptor of HOST_OUTLINE_TOOLS) {
        const name = descriptor.name as keyof typeof inputShapes;
        server.registerTool(name, {
            title: descriptor.title,
            description: descriptor.description,
            inputSchema: inputShapes[name],
            outputSchema: outputShape,
            annotations: descriptor.annotations,
            _meta: { ...descriptor._meta, securitySchemes: [{ type: 'noauth' }] },
        }, async (args: unknown) => {
            try { return { ...await getService().call(name, args) }; }
            catch (error) { return { ...toolError(error) }; }
        });
    }

    server.registerResource('quotecore-roof-outline-review', RESOURCE_URI, {
        mimeType: 'text/html;profile=mcp-app',
        description: 'Experimental editable roof outline review canvas. Requires the user to confirm geometry.',
    }, async (uri) => {
        const service = getService();
        const meta = {
            ui: { prefersBorder: true, csp: { connectDomains: [service.origin], resourceDomains: [] } },
            'openai/widgetDescription': 'Review and correct a host-proposed roof perimeter. No paid AI calls.',
            'openai/widgetCSP': { connect_domains: [service.origin], resource_domains: [] },
        };
        return { contents: [{ uri: uri.href, mimeType: 'text/html;profile=mcp-app', text: widgetHtml(service.origin), _meta: meta }] };
    });
}
