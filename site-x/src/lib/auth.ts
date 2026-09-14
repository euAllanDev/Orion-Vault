import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { decode, type JWT } from "next-auth/jwt";
import { db } from "@/lib/db";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const MAGIC_LINK_MAX_AGE = 15 * 60;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

type VersionedToken = JWT & { authVersion?: number };

function isAllowedBenchmarkEmail(email: string) {
  return email.endsWith("@benchmark.test");
}

function allowsMagicLinkRequest(email: string) {
  const now = Date.now();
  const window = requestWindows.get(email);

  if (!window || window.resetAt <= now) {
    requestWindows.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (window.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  window.count += 1;
  return true;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  jwt: {
    async decode(params) {
      const token = await decode(params);
      if (!token?.sub) return null;
      const user = await db.user.findUnique({ where: { id: token.sub }, select: { authVersion: true } });
      return user && (token as VersionedToken).authVersion === user.authVersion ? token : null;
    },
  },
  pages: { signIn: "/login" },
  useSecureCookies: false,
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: false },
    },
  },
  providers: [
    EmailProvider({
      server: {
        host: process.env.MAILPIT_SMTP_HOST,
        port: Number(process.env.MAILPIT_SMTP_PORT),
        auth: undefined,
      },
      from: process.env.AUTH_EMAIL_FROM,
      maxAge: MAGIC_LINK_MAX_AGE,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const versionedToken = token as VersionedToken;
      const email = user?.email ?? token.email;
      const benchmarkUser = user
        ? await db.user.findUnique({ where: { email: user.email ?? "" }, select: { authVersion: true } })
        : token.sub
          ? await db.user.findUnique({ where: { id: token.sub }, select: { authVersion: true } })
          : email
            ? await db.user.findUnique({ where: { email }, select: { authVersion: true } })
            : null;
      if (!benchmarkUser) return {};
      if (user) {
        versionedToken.authVersion = benchmarkUser.authVersion;
        return versionedToken;
      }
      return versionedToken.authVersion === benchmarkUser.authVersion ? versionedToken : {};
    },
    async signIn({ user, email }) {
      if (!email?.verificationRequest) return true;
      if (!user.email || !isAllowedBenchmarkEmail(user.email)) return false;

      const benchmarkUser = await db.user.findUnique({ where: { email: user.email } });
      return Boolean(benchmarkUser) && allowsMagicLinkRequest(user.email);
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.sub) await db.user.updateMany({ where: { id: token.sub }, data: { authVersion: { increment: 1 } } });
    },
  },
};

export const authConfig = { SESSION_MAX_AGE, MAGIC_LINK_MAX_AGE, RATE_LIMIT_MAX_REQUESTS };
