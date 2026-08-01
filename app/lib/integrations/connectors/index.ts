/**
 * Connector registry - maps provider names to connector loaders.
 * Called by the dispatcher to find the right connector for a queued export.
 */

import { registerConnector } from '../execution/dispatch';
import { getZapierConnector } from '../connectors/zapier/connector';

let registered = false;

/**
 * Register all connectors. Safe to call multiple times.
 */
export function ensureConnectorsRegistered() {
  if (registered) return;
  registered = true;

  registerConnector('zapier', async () => getZapierConnector());
  // Future: registerConnector('jobnimbus', async () => getJobNimbusConnector());
  // Future: registerConnector('fergus', async () => getFergusConnector());
}
