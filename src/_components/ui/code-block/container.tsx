import { useEffect, useEffectEvent, useRef } from "react";

import { useCodeBlockContext } from "./context";

export function CodeBlockContainer({ children }: { children: React.ReactNode }) {
  const { language, expanded, setContainerHeightPx } = useCodeBlockContext();
  const rootRef = useRef<HTMLDivElement>(null);

  const updateHeight = useEffectEvent((element?: HTMLDivElement) => {
    if (!element) return setContainerHeightPx(0);
    setContainerHeightPx(element.getBoundingClientRect().height);
  });

  useEffect(() => {
    if (!expanded) return updateHeight();
    if (typeof ResizeObserver === "undefined") return;

    const el = rootRef.current;
    if (!el) return;

    updateHeight(el);
    const ro = new ResizeObserver(() => updateHeight(el));

    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  return (
    <div
      ref={rootRef}
      data-language={language}
      data-slot="code-block-container"
      className="custom-scroll rounded-md border bg-background/80 text-foreground"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: `auto ${expanded ? "auto" : "350px"}`,
      }}
    >
      {children}
    </div>
  );
}
