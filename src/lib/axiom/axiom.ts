import { Axiom } from "@axiomhq/js";

import { env } from "@/env";

const axiomClient = new Axiom({ token: env.NEXT_PUBLIC_AXIOM_TOKEN });

export default axiomClient;
