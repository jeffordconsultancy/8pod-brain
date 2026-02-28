import { google } from 'googleapis';

const SCOPES: Record<string, string[]> = {
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
  'google-drive': ['https://www.googleapis.com/auth/drive.readonly'],
  'google-calendar': ['https://www.googleapis.com/auth/calendar.readonly'],
};

function getClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/oauth/callback`
  );
}

export function getGoogleAuthUrl(provider: string, state: string): string {
  return getClient().generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES[provider] || SCOPES.gmail,
    state,
    prompt: 'consent',
  });
}

export async function exchangeGoogleCode(code: string) {
  const { tokens } = await getClient().getToken(code);
  return tokens;
}
