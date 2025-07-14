import { ChevronUpIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Collapsible } from "@base-ui-components/react/collapsible";

import { ButtonWithTip } from "./button";

export function MermaidCodeblock({ id, ...props }: ComponentProps<"svg">) {
  if (!id?.startsWith("mermaid")) {
    return <svg id={id} {...props} />;
  }

  return (
    <Collapsible.Root
      defaultOpen
      data-slot="message-mermaid-codeblock"
      className="group/code-block overflow-hidden rounded-md border"
    >
      <div className="bg-muted/70 flex w-full items-center justify-between gap-2 rounded-md border-b px-2 py-1.5 backdrop-blur-md transition-[border-color] duration-300 group-data-[closed]/code-block:border-transparent">
        <Collapsible.Trigger
          render={ButtonWithTip}
          title="Collapse Code Block"
          className="hover:bg-accent/50 pointer-events-auto flex items-center gap-2 bg-transparent text-white"
        >
          <ChevronUpIcon className="size-5 transition-transform group-data-[closed]/code-block:rotate-180" />
        </Collapsible.Trigger>

        <span className="font-semibold select-none">Mermaid</span>

        <div>{/* <CopyButton content={code} /> */}</div>
      </div>

      <Collapsible.Panel className="flex h-[var(--collapsible-panel-height)] w-full flex-col justify-end overflow-hidden rounded-md border bg-[oklch(0.9067_0_0)] px-4 py-2 text-sm transition-all ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
        <svg id={id} {...props} className="mx-auto" />
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
