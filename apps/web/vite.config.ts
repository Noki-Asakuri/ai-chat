import { defineConfig } from "vite";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev",
    ),
  },
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools({ consolePiping: { levels: ["log"] } }),
    nitro({ compatibilityDate: "latest" }),
    tanstackStart({ srcDirectory: "src", router: { routesDirectory: "app" } }),
    viteReact(),
    babel({ presets: [reactCompilerPreset] }),
    tailwindcss(),
  ],
});
