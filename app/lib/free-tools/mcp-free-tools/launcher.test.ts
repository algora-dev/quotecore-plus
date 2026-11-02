import assert from 'node:assert/strict';
import test from 'node:test';
import { FREE_TOOLS_LAUNCHER_URI, FREE_TOOLS_LAUNCHER_VERSION, freeToolsLauncherHtml } from './launcher';

test('launcher publishes a new cache identity for the v4 ChatGPT UI contract', () => {
  assert.equal(FREE_TOOLS_LAUNCHER_URI, 'ui://quotecore/free-tools-launcher-v4-0-1.html');
  assert.equal(FREE_TOOLS_LAUNCHER_VERSION, '4.0.1');
  const html = freeToolsLauncherHtml();
  assert.match(html, /data-qcp-launcher-version="4\.0\.1"/);
  assert.match(html, /ui\/initialize/);
  assert.match(html, /ui\/notifications\/initialized/);
  assert.match(html, /ui\/notifications\/tool-result/);
  assert.match(html, /appCapabilities:\{availableDisplayModes:\['inline'\]\}/);
});

test('launcher uses host-mediated external navigation with compatibility fallbacks', () => {
  const html = freeToolsLauncherHtml();
  assert.match(html, /ui\/open-link/);
  assert.match(html, /window\.openai\.openExternal/);
  assert.match(html, /redirectUrl:false/);
  assert.match(html, /Promise\.resolve\(bridgeReady\)/);
  assert.match(html, /request\('ui\/open-link',\{url:url\},2500\)/);
  assert.match(html, /window\.open\(url,'_blank','noopener,noreferrer'\)/);
});
