// convex/convex.config.ts
import { defineApp } from "convex/server";

import crons from "@convex-dev/crons/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import r2 from "@convex-dev/r2/convex.config";
import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";

const app = defineApp();

app.use(r2);
app.use(crons);
app.use(migrations);
app.use(workOSAuthKit);

export default app;
