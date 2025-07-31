// convex/convex.config.ts
import { defineApp } from "convex/server";

import crons from "@convex-dev/crons/convex.config";
import r2 from "@convex-dev/r2/convex.config";

const app = defineApp();
app.use(r2);
app.use(crons);

export default app;
