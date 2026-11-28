import { afterAll, afterEach, beforeEach, describe, expect, mock, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(20_000);

// The DOM must exist before Testing Library loads: it binds `screen` to the document when first evaluated.
await import("@/test/dom");
const { act, render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

import type { FunctionReference } from "convex/server";

import type { ProfileLibrary } from "@/lib/profiles/profile-library";

import { testGroupId, testProfileId } from "@/test/fixtures";

const reviewer = testProfileId("profile-reviewer");
const writer = testProfileId("profile-writer");
const coding = testGroupId("group-coding");
const writing = testGroupId("group-writing");

function profile(id: typeof reviewer, name: string) {
  return {
    _id: id,
    _creationTime: 0,
    userId: "user",
    name,
    systemPrompt: `You are ${name}.`,
    createdAt: 0,
    updatedAt: 0,
  };
}

const library: ProfileLibrary = {
  profiles: [profile(reviewer, "Reviewer"), profile(writer, "Writer")],
  groups: [
    { _id: coding, title: "Coding", profileId: reviewer },
    { _id: writing, title: "Writing", profileId: writer },
  ],
  ungroupedProfileId: null,
};

const LIBRARY_KEY = ["profile-library"];

// Only the profile library is ever fetched here; a skipped query (a new chat has no thread) stays off.
await mock.module("@convex-dev/react-query", () => ({
  convexQuery: (_ref: FunctionReference<"query">, args: Record<string, never> | "skip") =>
    args === "skip"
      ? { queryKey: ["skipped"], enabled: false }
      : { queryKey: LIBRARY_KEY, queryFn: async () => library, staleTime: Infinity },
}));
await mock.module("@/lib/assets/urls", () => ({
  buildImageAssetUrl: (path: string) => `https://assets.test/${path}`,
  buildImageThumbnailUrl: (url: string) => url,
}));
const actualRouter = await import("@tanstack/react-router");
await mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  // A new chat: no thread in the URL.
  useParams: () => undefined,
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/settings/profiles" className={className}>
      {children}
    </a>
  ),
}));
await mock.module("@/lib/trpc/client", () => ({ syncThreadModelConfig: async () => {} }));

const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { ConfigStoreContext } = await import("@/components/provider/config-provider");
const { createConfigStore } = await import("@/lib/store/config-store");
const { threadStoreActions, useThreadStore } = await import("@/lib/store/thread-store");
const { NewChatProfileDefault } = await import("./new-chat-profile-default");
const { ChatProfilePicker } = await import("../chat-textarea/profile-picker");

afterAll(() => mock.restore());

beforeEach(() => {
  threadStoreActions.setActiveGroupId(coding);
  threadStoreActions.forgetNewChatProfile();
});

// Unmounting queues a React scheduler task; let it run before the shared setup removes the DOM.
afterEach(() => new Promise((resolve) => setTimeout(resolve, 20)));

function renderChat(children: React.ReactNode) {
  const store = createConfigStore({ model: "google/gemini-2.5-pro" });
  const queryClient = new QueryClient();
  queryClient.setQueryData(LIBRARY_KEY, library);

  render(
    <QueryClientProvider client={queryClient}>
      <ConfigStoreContext.Provider value={store}>{children}</ConfigStoreContext.Provider>
    </QueryClientProvider>,
  );
  return { store, queryClient };
}

describe("NewChatProfileDefault", () => {
  test("gives a new chat its group's default", async () => {
    const { store } = renderChat(<NewChatProfileDefault />);
    await waitFor(() => expect(store.getState().modelParams.profile).toBe(reviewer));
    expect(store.getState().profileChosen).toBe(false);
  });

  test("keeps a hand pick when the defaults change", async () => {
    const { store, queryClient } = renderChat(<NewChatProfileDefault />);
    await waitFor(() => expect(store.getState().modelParams.profile).toBe(reviewer));

    act(() => store.getState().chooseProfile(null));
    act(() => {
      queryClient.setQueryData<ProfileLibrary>(LIBRARY_KEY, {
        ...library,
        groups: library.groups.map((group) => Object.assign({}, group, { profileId: writer })),
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().modelParams.profile).toBeNull();
  });

  test("starts over with the new group's default when the group changes, even after a hand pick", async () => {
    const { store } = renderChat(<NewChatProfileDefault />);
    await waitFor(() => expect(store.getState().modelParams.profile).toBe(reviewer));

    act(() => store.getState().chooseProfile(null));
    act(() => useThreadStore.getState().setActiveGroupId(writing));

    await waitFor(() => expect(store.getState().modelParams.profile).toBe(writer));
    expect(store.getState().profileChosen).toBe(false);
  });
});

describe("ChatProfilePicker", () => {
  test("choosing the profile already shown counts as a hand pick", async () => {
    const user = userEvent.setup();
    const { store } = renderChat(
      <>
        <NewChatProfileDefault />
        <ChatProfilePicker />
      </>,
    );
    await waitFor(() => expect(store.getState().modelParams.profile).toBe(reviewer));
    expect(store.getState().profileChosen).toBe(false);

    await user.click(screen.getByRole("button", { name: "Profile: Reviewer" }));
    await user.click(await screen.findByRole("option", { name: /Reviewer/ }));

    await waitFor(() => expect(store.getState().profileChosen).toBe(true));
    expect(store.getState().modelParams.profile).toBe(reviewer);
    // Kept with the unsent draft, so it comes back after a trip to Settings.
    expect(useThreadStore.getState().newChatProfile).toEqual({
      newChatKey: useThreadStore.getState().newChatKey,
      groupId: coding,
      profileId: reviewer,
    });
  });
});
