import { ConvexHttpClient, type HttpMutationOptions } from "convex/browser";
import type {
  ArgsAndOptions,
  FunctionReference,
  FunctionReturnType,
  OptionalRestArgs,
} from "convex/server";

import { env } from "../env";

export type ServerConvexClient = {
  query<Query extends FunctionReference<"query">>(
    query: Query,
    ...args: OptionalRestArgs<Query>
  ): Promise<FunctionReturnType<Query>>;
  mutation<Mutation extends FunctionReference<"mutation">>(
    mutation: Mutation,
    ...args: ArgsAndOptions<Mutation, HttpMutationOptions>
  ): Promise<FunctionReturnType<Mutation>>;
  action<Action extends FunctionReference<"action">>(
    action: Action,
    ...args: OptionalRestArgs<Action>
  ): Promise<FunctionReturnType<Action>>;
};

type AccessTokenProvider = {
  getAccessToken: () => Promise<string>;
};

async function createAuthorizedClient(
  accessTokenProvider: AccessTokenProvider,
): Promise<InstanceType<typeof ConvexHttpClient>> {
  const accessToken = await accessTokenProvider.getAccessToken();
  return new ConvexHttpClient(env.CONVEX_URL, { auth: accessToken });
}

export function createServerConvexClient(
  accessTokenProvider: AccessTokenProvider,
): ServerConvexClient {
  return {
    async query<Query extends FunctionReference<"query">>(
      query: Query,
      ...args: OptionalRestArgs<Query>
    ): Promise<FunctionReturnType<Query>> {
      const serverConvexClient = await createAuthorizedClient(accessTokenProvider);
      return await serverConvexClient.query(query, ...args);
    },
    async mutation<Mutation extends FunctionReference<"mutation">>(
      mutation: Mutation,
      ...args: ArgsAndOptions<Mutation, HttpMutationOptions>
    ): Promise<FunctionReturnType<Mutation>> {
      const serverConvexClient = await createAuthorizedClient(accessTokenProvider);
      return await serverConvexClient.mutation(mutation, ...args);
    },
    async action<Action extends FunctionReference<"action">>(
      action: Action,
      ...args: OptionalRestArgs<Action>
    ): Promise<FunctionReturnType<Action>> {
      const serverConvexClient = await createAuthorizedClient(accessTokenProvider);
      return await serverConvexClient.action(action, ...args);
    },
  };
}
