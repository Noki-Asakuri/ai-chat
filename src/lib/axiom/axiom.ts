import { Axiom } from "@axiomhq/js";

import { env } from "@/env";

const axiomClient = new Axiom({ token: env.VITE_AXIOM_TOKEN });

export default axiomClient;
