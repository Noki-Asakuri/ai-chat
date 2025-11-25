import z from "zod";

import { api } from "@/convex/_generated/api";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const groupRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ title: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.convexClient.mutation(api.functions.groups.createGroup, input);
    }),
});
