"use client";

import dynamic from "next/dynamic";

import { LoadingPage } from "@/components/loading-page";

const App = dynamic(() => import("@/frontend/app"), {
  ssr: false,
  loading: () => <LoadingPage key="loading-page" text="Loading app..." />,
});

export default App;
