import type { OptimisticLocalStore, OptimisticUpdate } from "convex/browser";
import type { ConvexReactClient } from "convex/react";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
  type OptionalRestArgs,
} from "convex/server";
import { convexToJson } from "convex/values";

// The query references `OptimisticLocalStore` accepts.
type QueryRef = Parameters<OptimisticLocalStore["getAllQueries"]>[0];
type MutationRef = FunctionReference<"mutation">;
type AnyArgs = FunctionArgs<QueryRef>;

type QueuedMutation = {
  name: string;
  layer: { update: OptimisticUpdate<AnyArgs>; args: AnyArgs } | null;
  run: () => FunctionReturnType<MutationRef>;
  resolve: (value: FunctionReturnType<MutationRef>) => void;
  reject: (error: Error) => void;
};

// `ConvexQueryClient` passes function names, app code passes references; `getFunctionName` takes both.
function keyOf(ref: QueryRef | MutationRef, args: AnyArgs = {}) {
  return `${getFunctionName(ref)}|${JSON.stringify(convexToJson(args))}`;
}

class LocalView implements OptimisticLocalStore {
  constructor(readonly results: Map<string, FunctionReturnType<QueryRef>>) {}

  getQuery<Query extends QueryRef>(query: Query, ...args: OptionalRestArgs<Query>) {
    // SAFETY: results are keyed by function name, and each key is only ever set with that query's result.
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
    return this.results.get(keyOf(query, args[0])) as FunctionReturnType<Query> | undefined;
  }

  setQuery<Query extends QueryRef>(
    query: Query,
    args: FunctionArgs<Query>,
    value: FunctionReturnType<Query> | undefined,
  ) {
    this.results.set(keyOf(query, args), value);
  }

  getAllQueries() {
    return [];
  }
}

/**
 * A stand-in for `ConvexReactClient` with the semantics the composer relies on:
 * - mutations reach the "server" in the order they were sent, and each waits until the test settles it;
 * - an optimistic update is layered over the server's query results until its mutation settles, then
 *   dropped, whether the mutation succeeded or failed;
 * - `watchQuery(...).localQueryResult()` returns the server value with the pending layers applied.
 *
 * It is used behind the real `ConvexQueryClient` and TanStack Query, as in the app.
 */
export class FakeConvexClient {
  readonly mutations: Array<{ name: string; args: AnyArgs }> = [];
  /** While false, the subscription has delivered nothing yet: local results are empty and queries wait. */
  connected = true;

  private server = new LocalView(new Map());
  private queue: QueuedMutation[] = [];
  private listeners = new Set<() => void>();
  private handlers = new Map<string, (args: never) => FunctionReturnType<MutationRef>>();

  get pending() {
    return this.queue.length;
  }

  /** Passes this fake wherever the app expects the real client. */
  asReactClient() {
    // SAFETY: the composer, `ConvexProvider` and `ConvexQueryClient` only use the methods implemented here.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
    return this as unknown as ConvexReactClient;
  }

  /** What the server does, and returns, when a mutation runs. Mutations without a handler return null. */
  onMutation<Mutation extends MutationRef>(
    ref: Mutation,
    handler: (args: FunctionArgs<Mutation>) => FunctionReturnType<Mutation>,
  ) {
    this.handlers.set(getFunctionName(ref), handler);
  }

  /** The arguments of each call to one mutation, oldest first. */
  callsOf<Mutation extends MutationRef>(ref: Mutation) {
    const name = getFunctionName(ref);
    return this.mutations
      .filter((call) => call.name === name)
      .map(
        // SAFETY: calls are recorded under the name of the mutation they were made with, with its arguments.
        // eslint-disable-next-line typescript/no-unsafe-type-assertion
        (call) => call.args as FunctionArgs<Mutation>,
      );
  }

  getServerQuery<Query extends QueryRef>(query: Query, args: FunctionArgs<Query>) {
    return this.server.getQuery(query, args);
  }

  /** Sets a query's server value, as a push from the backend would. */
  setServerQuery<Query extends QueryRef>(
    query: Query,
    args: FunctionArgs<Query>,
    value: FunctionReturnType<Query>,
    notify = true,
  ) {
    this.server.setQuery(query, args, value);
    if (notify) this.notify();
  }

  watchQuery<Query extends QueryRef>(query: Query, args: FunctionArgs<Query>) {
    return {
      onUpdate: (callback: () => void) => {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
      },
      localQueryResult: () => (this.connected ? this.local().getQuery(query, args) : undefined),
      journal: () => undefined,
    };
  }

  query<Query extends QueryRef>(query: Query, args: FunctionArgs<Query>) {
    if (!this.connected) return new Promise<FunctionReturnType<Query> | undefined>(() => {});
    return Promise.resolve(this.local().getQuery(query, args));
  }

  mutation<Mutation extends MutationRef>(
    ref: Mutation,
    args: FunctionArgs<Mutation>,
    options?: { optimisticUpdate?: OptimisticUpdate<FunctionArgs<Mutation>> },
  ) {
    const name = getFunctionName(ref);
    this.mutations.push({ name, args });

    // SAFETY: handlers are stored under the name of the mutation they were registered for.
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
    const handler = this.handlers.get(name) as
      ((args: FunctionArgs<Mutation>) => FunctionReturnType<Mutation>) | undefined;

    return new Promise<FunctionReturnType<Mutation>>((resolve, reject) => {
      const layer = options?.optimisticUpdate ? { update: options.optimisticUpdate, args } : null;
      const run = () => (handler ? handler(args) : null);
      this.queue.push({ name, layer, run, resolve, reject });
      if (layer) this.notify();
    });
  }

  /** Runs the oldest pending mutation on the server and drops its optimistic layer, in one step. */
  async succeedNext() {
    const next = this.queue.shift();
    if (!next) throw new Error("No pending mutation");

    const result = next.run();
    this.notify();
    next.resolve(result);
    await Promise.resolve();
  }

  /** Fails the oldest pending mutation: the server is unchanged and its optimistic layer is dropped. */
  async failNext(message = "Server error") {
    const next = this.queue.shift();
    if (!next) throw new Error("No pending mutation");

    this.notify();
    next.reject(new Error(message));
    await Promise.resolve();
  }

  async settleAll() {
    const count = this.queue.length;
    for (let index = 0; index < count; index++) {
      // Mutations must settle one at a time, in the order they were sent.
      // oxlint-disable-next-line no-await-in-loop
      await this.succeedNext();
    }
  }

  private local() {
    const view = new LocalView(new Map(this.server.results));
    for (const { layer } of this.queue) if (layer) layer.update(view, layer.args);
    return view;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}
