"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const callbackUrl = String(formData.get("callbackUrl") ?? "");
  const redirectTo = callbackUrl.startsWith("/admin") ? callbackUrl : "/admin";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo,
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      if ("code" in e && e.code === "rate_limited") {
        return { error: "Too many sign-in attempts. Please wait 15 minutes and try again." };
      }
      return { error: "Invalid email or password" };
    }
    throw e; // NEXT_REDIRECT on success
  }
}
