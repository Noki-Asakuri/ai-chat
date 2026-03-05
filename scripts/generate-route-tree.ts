import { getConfig, Generator } from "@tanstack/router-generator";

async function main() {
  const config = getConfig(
    { routesDirectory: "./src/app", generatedRouteTree: "./src/routeTree.gen.ts" },
    process.cwd(),
  );

  const generator = new Generator({ config, root: process.cwd() });
  await generator.run();
}

void main();
