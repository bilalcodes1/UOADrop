import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const outputPath = process.env.UOADROP_RUNTIME_CONFIG_OUT
  ? resolve(process.env.UOADROP_RUNTIME_CONFIG_OUT)
  : resolve(process.cwd(), 'resources/runtime-config.json');

const desktopGatewayUrl = String(process.env.UOADROP_DESKTOP_GATEWAY_URL ?? process.env.UOADROP_WEB_BASE_URL ?? '').trim();

if (!desktopGatewayUrl) {
  console.error('Missing required env var: UOADROP_DESKTOP_GATEWAY_URL or UOADROP_WEB_BASE_URL');
  process.exit(1);
}

const payload = {
  desktopGatewayUrl,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`[UOADrop] Wrote runtime config to ${outputPath}`);
