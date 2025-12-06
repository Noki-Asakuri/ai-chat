import { httpRouter } from "convex/server";

// import { clerkWebhook } from "./functions/users";

const http = httpRouter();
// http.route({
//   method: "POST",
//   path: "/webhook/clerk",
//   handler: clerkWebhook,
// });

export default http;
