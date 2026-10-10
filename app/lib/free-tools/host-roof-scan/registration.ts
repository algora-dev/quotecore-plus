import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HOST_OUTLINE_TOOLS } from './contract';
import { inputShapes, outputShape } from './schemas';
import { toolError, type HostOutlineService } from './service';
import { RESOURCE_URI } from './types';
import { widgetHtml } from './widget';
import { mcpWireResult } from './image-delivery';

/** Register on the EXISTING server, without replacing any legacy handlers. Lazy service creation
 * means listing tools needs neither a storage request nor a service-role credential. */
export function registerHostOutlineTools(server: McpServer, getService: () => HostOutlineService): void {
    for (const descriptor of HOST_OUTLINE_TOOLS) {
        const name = descriptor.name as keyof typeof inputShapes;
        server.registerTool(name, {
            title: descriptor.title,
            description: descriptor.description,
            inputSchema: inputShapes[name],
            ...(name === 'qc_get_roof_outline_image' ? {} : { outputSchema: outputShape }),
            annotations: descriptor.annotations,
            _meta: { ...descriptor._meta, securitySchemes: [{ type: 'noauth' }] },
        }, async (args: unknown) => {
            let result;
            try { result = await getService().call(name, args); }
            catch (error) { result = toolError(error); }
            return { ...mcpWireResult(name, result) };
        });
    }

    server.registerResource('quotecore-roof-outline-review', RESOURCE_URI, {
        mimeType: 'text/html;profile=mcp-app',
        description: 'Experimental editable roof outline review canvas. Requires the user to confirm geometry.',
    }, async (uri) => {
        const service = getService();
        const meta = {
            ui: { prefersBorder: true, csp: { connectDomains: [service.origin], resourceDomains: [] } },
            'openai/widgetDescription': 'Upload, share the exact prepared image with your AI, then review a proposed roof perimeter. If this editor is absent, show the review link. No paid AI calls.',
            'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'] },
            'openai/widgetCSP': { connect_domains: [service.origin], resource_domains: [] },
        };
        return { contents: [{ uri: uri.href, mimeType: 'text/html;profile=mcp-app', text: widgetHtml(service.origin), _meta: meta }] };
    });
}
