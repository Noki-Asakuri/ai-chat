// convex/convex.config.ts
import { defineApp } from "convex/server";

import actionRetrier from "@convex-dev/action-retrier/convex.config.js";
import crons from "@convex-dev/crons/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import r2 from "@convex-dev/r2/convex.config";
import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";

const app = defineApp();

app.use(r2);
app.use(crons);
app.use(migrations);
app.use(workOSAuthKit);
app.use(actionRetrier);

export default app;
