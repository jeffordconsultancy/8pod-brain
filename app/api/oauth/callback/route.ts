import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptToken } from '@/lib/crypto';
import { exchangeGoogleCode } from '@/lib/oauth/google';
import { exchangeSlackCode } from '@/lib/oauth/slack';
import { exchangeGitHubCode } from '@/lib/oauth/github';
import { ConnectionProvider } from '@prisma/client';

export async function GET(request: NextRequest) {
  // Use NEXTAUTH_URL for redirects since request.nextUrl.origin returns localhost behind reverse proxy
  const base = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const stored = request.cookies.get('oauth_state')?.value;
    const provider = request.cookies.get('oauth_provider')?.value;
    const workspaceId = request.cookies.get('oauth_workspace')?.value;

    if (!state || state !== stored || !code || !provider || !workspaceId) {
      return NextResponse.redirect(new URL('/connections?error=invalid', base), 302);
    }

    let tokens: any;
    if (['gmail', 'google-drive', 'google-calendar'].includes(provider)) {
      tokens = await exchangeGoogleCode(code);
    } else if (provider === 'slack') {
      tokens = await exchangeSlackCode(code);
    } else if (provider === 'github') {
      tokens = await exchangeGitHubCode(code);
    } else {
      return NextResponse.redirect(new URL('/connections?error=unsupported', base), 302);
    }

    const map: Record<string, ConnectionProvider> = {
      gmail: 'GMAIL', 'google-drive': 'GOOGLE_DRIVE', 'google-calendar': 'GOOGLE_CALENDAR',
      slack: 'SLACK', github: 'GITHUB',
    };

    const member = await db.workspaceMember.findFirst({ where: { workspaceId } });
    await db.connection.deleteMany({ where: { workspaceId, provider: map[provider] } });
    await db.connection.create({
      data: {
        workspaceId,
        provider: map[provider],
        accessToken: tokens.access_token ? encryptToken(tokens.access_token) : null,
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope,
        createdById: member?.userId || '',
      },
    });

    const res = NextResponse.redirect(new URL('/connections?success=true', base), 302);
    res.cookies.delete('oauth_state');
    res.cookies.delete('oauth_provider');
    res.cookies.delete('oauth_workspace');
    return res;
  } catch (e) {
    console.error('OAuth callback error:', e);
    return NextResponse.redirect(new URL('/connections?error=failed', base), 302);
  }
}
