import { useEffect, useEffectEvent, useRef } from "react";

import { useCodeBlockContext } from "./context";

export function CodeBlockContainer({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { language, expanded, setContainerHeightPx } = useCodeBlockContext();

  const updateHeight = useEffectEvent((element?: HTMLDivElement) => {
    if (!element) return setContainerHeightPx(0);
    setContainerHeightPx(element.getBoundingClientRect().height);
  });

  useEffect(() => {
    if (!expanded) return updateHeight();
    if (!rootRef.current) return;

    updateHeight(rootRef.current);
    const resizeObserver = new ResizeObserver(() => updateHeight(rootRef.current!));

    resizeObserver.observe(rootRef.current);

    return function cleanup() {
      resizeObserver.disconnect();
    };
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
