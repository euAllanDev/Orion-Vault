import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { db } from "@/lib/db";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const MAGIC_LINK_MAX_AGE = 15 * 60;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

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
    async signIn({ user, email }) {
      if (!email?.verificationRequest) return true;
      if (!user.email || !isAllowedBenchmarkEmail(user.email)) return false;

      const benchmarkUser = await db.user.findUnique({ where: { email: user.email } });
      return Boolean(benchmarkUser) && allowsMagicLinkRequest(user.email);
    },
  },
};

export const authConfig = { SESSION_MAX_AGE, MAGIC_LINK_MAX_AGE, RATE_LIMIT_MAX_REQUESTS };
