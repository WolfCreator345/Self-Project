import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { clientIp, hitRateLimit, resetRateLimit } from "./lib/rate-limit";

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

// Used when the email doesn't match, so response time doesn't reveal valid emails.
const DUMMY_HASH = "$2b$12$yWG0Vz3YPEU/WWfB6Dw6IOGJv7v8H7Lu4BZfVI3OHPnpNkJR3bJtW";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials, request) {
        const ip = clientIp(request.headers);
        if (hitRateLimit(`login:${ip}`).limited) throw new RateLimited();

        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const adminHash = process.env.ADMIN_PASSWORD_HASH?.trim();
        if (!adminEmail || !adminHash) {
          console.error("[auth] ADMIN_EMAIL / ADMIN_PASSWORD_HASH not set in .env.local");
          return null;
        }

        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password || password.length > 200) return null;

        const emailOk = email === adminEmail;
        const passOk = await bcrypt.compare(password, emailOk ? adminHash : DUMMY_HASH);
        if (!emailOk || !passOk) return null;

        resetRateLimit(`login:${ip}`);
        return { id: "library-assistant", email: adminEmail, name: process.env.ADMIN_NAME?.trim() || "Library Assistant" };
      },
    }),
  ],
});
