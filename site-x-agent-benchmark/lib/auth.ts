import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";
import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";

const requests = new Map<string, number[]>();

function canRequestLink(email: string) {
  const now = Date.now();
  const recent = (requests.get(email) ?? []).filter((time) => now - time < 15 * 60 * 1000);
  if (recent.length >= 5) return false;
  recent.push(now);
  requests.set(email, recent);
  return true;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.AUTH_SECRET,
  providers: [
    EmailProvider({
      server: {
        host: process.env.MAILPIT_SMTP_HOST,
        port: Number(process.env.MAILPIT_SMTP_PORT ?? 1025),
        secure: false,
      },
      from: process.env.MAIL_FROM,
      maxAge: 15 * 60,
    }),
  ],
  callbacks: {
    async signIn({ user, email }) {
      const address = user.email?.toLowerCase();
      if (!address?.endsWith("@benchmark.test")) return false;
      const existing = await db.user.findUnique({ where: { email: address } });
      return Boolean(existing && (!email?.verificationRequest || canRequestLink(address)));
    },
  },
  cookies: {
    sessionToken: {
      name: "fieldnote.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
};
