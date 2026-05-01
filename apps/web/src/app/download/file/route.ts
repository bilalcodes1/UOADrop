import { NextRequest, NextResponse } from 'next/server';

const DOWNLOAD_BASE_URL = 'https://github.com/bilalcodes1/UOADrop/releases/latest/download';
const DEFAULT_FILE_NAME = 'UOADrop Setup 0.1.0.exe';

const assets: Record<string, string> = {
  'mac-arm64-dmg': 'UOADrop-0.1.0-arm64.dmg',
  'mac-x64-dmg': 'UOADrop-0.1.0.dmg',
  'mac-arm64-zip': 'UOADrop-0.1.0-arm64-mac.zip',
  'mac-x64-zip': 'UOADrop-0.1.0-mac.zip',
  'win-x64-installer': 'UOADrop Setup 0.1.0.exe',
  'win-x64-portable': 'UOADrop 0.1.0.exe',
  'win-arm64-installer': 'UOADrop Setup 0.1.0-arm64.exe',
  'linux-x64-appimage': 'UOADrop-0.1.0.AppImage',
};

function getDefaultAsset(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() ?? '';
  if (userAgent.includes('mac os') || userAgent.includes('macintosh')) return 'mac-arm64-dmg';
  if (userAgent.includes('windows')) return 'win-x64-installer';
  if (userAgent.includes('linux')) return 'linux-x64-appimage';
  return 'win-x64-installer';
}

export function GET(request: NextRequest) {
  const requestedAsset = request.nextUrl.searchParams.get('asset') ?? getDefaultAsset(request);
  const fileName = assets[requestedAsset] ?? assets[getDefaultAsset(request)] ?? DEFAULT_FILE_NAME;
  const url = `${DOWNLOAD_BASE_URL}/${encodeURIComponent(fileName)}`;

  return NextResponse.redirect(url, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
