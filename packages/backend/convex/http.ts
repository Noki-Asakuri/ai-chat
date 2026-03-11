import { httpRouter } from "convex/server";

import { authKit } from "./components";

const http = httpRouter();
authKit.registerRoutes(http);

export default http;
