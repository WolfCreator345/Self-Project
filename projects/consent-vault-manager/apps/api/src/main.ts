import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import session from "express-session";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  // Cookies require credentials:true paired with a specific (non-wildcard)
  // origin — the dashboard (Vite dev server) runs on its own port, so this
  // is a cross-origin (same-site) request from the browser's perspective.
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true });

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) throw new Error("SESSION_SECRET must be set in the environment");

  // MemoryStore (express-session's default) is fine for this phase's single-
  // admin, single-process demo scope, but is explicitly not production-safe:
  // sessions vanish on restart and don't share state across instances. A
  // real deployment would swap in a Redis- or Postgres-backed session store
  // here without changing anything else in this file.
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 24 * 60 * 60 * 1000 },
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`[api] Consent Vault API listening on http://localhost:${port}`);
}

bootstrap();
