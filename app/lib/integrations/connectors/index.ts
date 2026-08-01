/**
 * Connector registry.
 *
 * Each connector is lazy-loaded to keep the cron handler fast.
 * ensureConnectorsRegistered() is called at the start of processNextExport().
 */

import type { Connector } from '../contracts/connector';
import { getZapierConnector } from './zapier/connector';
import { getJobNimbusConnector } from './jobnimbus/connector';

const connectorRegistry = new Map<string, () => Promise<Connector>>();

export function registerConnector(provider: string, loader: () => Promise<Connector>) {
  connectorRegistry.set(provider, loader);
}

export function ensureConnectorsRegistered() {
  if (!connectorRegistry.has('zapier')) {
    registerConnector('zapier', async () => getZapierConnector());
  }
  if (!connectorRegistry.has('jobnimbus')) {
    registerConnector('jobnimbus', async () => getJobNimbusConnector());
  }
}

export function getRegisteredProviders(): string[] {
  return Array.from(connectorRegistry.keys());
}
