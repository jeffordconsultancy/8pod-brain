import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getGoogleAuthUrl } from '@/lib/oauth/google';
import { getSlackAuthUrl } from '@/lib/oauth/slack';
import { getGitHubAuthUrl } from '@/lib/oauth/github';

type AuthUrlFn = (provider: string, state: string) => string;

const PROVIDERS: Record<string, AuthUrlFn> = {
  gmail: getGoogleAuthUrl,
  'google-drive': getGoogleAuthUrl,
  'google-calendar': getGoogleAuthUrl,
  slack: getSlackAuthUrl,
  github: getGitHubAuthUrl,
};

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider;
  const workspaceId = request.nextUrl.searchParams.get('workspace');
  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing workspace' }, { status: 400 });
  }

  const getAuthUrl = PROVIDERS[provider];
  if (!getAuthUrl) {
    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  }

  const state = randomBytes(32).toString('hex');
  const authUrl = getAuthUrl(provider, state);

  const response = NextResponse.redirect(new URL(authUrl), 302);
  const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 600 };
  response.cookies.set('oauth_state', state, cookieOpts);
  response.cookies.set('oauth_provider', provider, cookieOpts);
  response.cookies.set('oauth_workspace', workspaceId, cookieOpts);
  return response;
}
