import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Redirects to /login (with callbackUrl) when there is no session.
export const { auth: middleware } = NextAuth(authConfig);

export const config = { matcher: ["/admin/:path*"], runtime: "nodejs" };
