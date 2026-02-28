export function getSlackAuthUrl(_provider: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID || '',
    scope: 'channels:read,channels:history,chat:write',
    redirect_uri: `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/oauth/callback`,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export async function exchangeSlackCode(code: string) {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID || '',
      client_secret: process.env.SLACK_CLIENT_SECRET || '',
      code,
      redirect_uri: `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/oauth/callback`,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return { access_token: data.authed_user?.access_token || data.access_token, scope: data.scope };
}
