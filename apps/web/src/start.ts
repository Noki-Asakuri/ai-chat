import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Configure the service before AuthKit initializes so session and PKCE cookies share settings.
const configureAuthKitMiddleware = createMiddleware().server(async ({ next }) => {
  const { configure } = await import("@workos/authkit-session");
  const { env } = await import("./env");

  configure({
    cookieDomain: env.WORKOS_COOKIE_DOMAIN,
    cookieSameSite: env.WORKOS_COOKIE_SAME_SITE,
  });

  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, configureAuthKitMiddleware, authkitMiddleware()],
}));
