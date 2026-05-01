import { NextRequest, NextResponse } from 'next/server';

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type ReleaseResponse = {
  assets?: Array<Partial<ReleaseAsset>>;
};

const LATEST_RELEASE_API = 'https://api.github.com/repos/bilalcodes1/UOADrop/releases/latest';

const assetMatchers: Record<string, (name: string) => boolean> = {
  'mac-arm64-dmg': (name) => name.endsWith('.dmg') && name.includes('arm64'),
  'mac-x64-dmg': (name) => name.endsWith('.dmg') && !name.includes('arm64'),
  'mac-arm64-zip': (name) => name.endsWith('.zip') && name.includes('mac') && name.includes('arm64'),
  'mac-x64-zip': (name) => name.endsWith('.zip') && name.includes('mac') && !name.includes('arm64'),
  'win-x64-installer': (name) => name.endsWith('.exe') && name.includes('setup') && !name.includes('arm64'),
  'win-x64-portable': (name) => name.endsWith('.exe') && !name.includes('setup') && !name.includes('arm64'),
  'win-arm64-installer': (name) => name.endsWith('.exe') && name.includes('setup') && name.includes('arm64'),
  'linux-x64-appimage': (name) => name.endsWith('.appimage') && !name.includes('arm64'),
};

function getDefaultAsset(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() ?? '';
  if (userAgent.includes('mac os') || userAgent.includes('macintosh')) return 'mac-arm64-dmg';
  if (userAgent.includes('windows')) return 'win-x64-installer';
  if (userAgent.includes('linux')) return 'linux-x64-appimage';
  return 'win-x64-installer';
}

function isReleaseAsset(asset: Partial<ReleaseAsset>): asset is ReleaseAsset {
  return Boolean(asset.name && asset.browser_download_url);
}

async function getLatestReleaseAssets(): Promise<ReleaseAsset[]> {
  const response = await fetch(LATEST_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'UOADrop-download-page',
    },
    cache: 'no-store',
  });

  if (!response.ok) return [];

  const release = (await response.json()) as ReleaseResponse;
  return release.assets?.filter(isReleaseAsset) ?? [];
}

function pickAsset(assets: ReleaseAsset[], assetKey: string): ReleaseAsset | undefined {
  const matcher = assetMatchers[assetKey];
  if (!matcher) return undefined;
  return assets.find((asset) => matcher(asset.name.toLowerCase()));
}

export async function GET(request: NextRequest) {
  const requestedAsset = request.nextUrl.searchParams.get('asset') ?? getDefaultAsset(request);
  const releaseAssets = await getLatestReleaseAssets();
  const asset = pickAsset(releaseAssets, requestedAsset) ?? pickAsset(releaseAssets, getDefaultAsset(request));

  if (!asset) {
    return NextResponse.json(
      { error: 'Download file is not available yet.' },
      {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  return NextResponse.redirect(asset.browser_download_url, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
