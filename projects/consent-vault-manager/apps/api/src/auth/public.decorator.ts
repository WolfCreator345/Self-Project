import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Exempts a route from SessionAuthGuard — used only by the login/logout endpoints. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
