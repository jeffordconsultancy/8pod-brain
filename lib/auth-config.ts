import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { db } from './db';

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          include: { memberships: { include: { workspace: true }, orderBy: { joinedAt: 'desc' }, take: 1 } },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;

        const workspaceId = user.memberships[0]?.workspaceId || '';

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          workspaceId,
        };
      },
    }),
  ],
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' && user.email) {
        // Find or create user + workspace for Google sign-in
        let dbUser = await db.user.findUnique({
          where: { email: user.email },
          include: { memberships: { include: { workspace: true }, orderBy: { joinedAt: 'desc' }, take: 1 } },
        });

        if (!dbUser) {
          // Auto-create user and workspace on first Google sign-in
          const workspace = await db.workspace.create({
            data: { name: `${user.name || user.email}'s Workspace` },
          });
          dbUser = await db.user.create({
            data: {
              email: user.email,
              name: user.name || user.email.split('@')[0],
              memberships: {
                create: { workspaceId: workspace.id, role: 'owner' },
              },
            },
            include: { memberships: { include: { workspace: true }, orderBy: { joinedAt: 'desc' }, take: 1 } },
          });
          // Set workspace owner
          await db.workspace.update({ where: { id: workspace.id }, data: { ownerId: dbUser.id } });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google' && user.email) {
          // Look up the DB user to get id + workspaceId
          const dbUser = await db.user.findUnique({
            where: { email: user.email },
            include: { memberships: { orderBy: { joinedAt: 'desc' }, take: 1 } },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.workspaceId = dbUser.memberships[0]?.workspaceId || '';
          }
        } else {
          token.id = user.id;
          token.workspaceId = (user as any).workspaceId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session as any).workspaceId = token.workspaceId;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
