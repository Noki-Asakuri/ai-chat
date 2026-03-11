import { createContext, useContext, useState, type Dispatch } from "react";
import { useShallow } from "zustand/shallow";

import { useConfigStore, useConfigStoreState } from "@/components/provider/config-provider";

interface CodeBlockContextType {
  /**
   * The code to be displayed.
   */
  code: string;

  /**
   * The language of the code block.
   */
  language: string;

  /**
   * The total number of lines in the code block.
   */
  totalLines: number;

  /**
   * Whether the code block is expanded.
   */
  expanded: boolean;

  /**
   * Set the expanded state of the code block.
   */
  setExpanded: Dispatch<React.SetStateAction<boolean>>;

  /**
   * Whether to wrap long code lines.
   */
  wrapline: boolean;

  /**
   * Toggle the wrapline state.
   */
  toggleWrapline: () => void;

  /**
   * The height of the code block container in pixels.
   */
  containerHeightPx: number;

  /**
   * Set the height of the code block container in pixels.
   */
  setContainerHeightPx: Dispatch<React.SetStateAction<number>>;
}

export const CodeBlockContext = createContext<CodeBlockContextType | null>(null);

export const useCodeBlockContext = () =>
  useContext(CodeBlockContext as React.Context<CodeBlockContextType>);

type CodeBlockProviderProps = {
  code: string;
  language: string;
  totalLines: number;
  children: React.ReactNode;
};

export function CodeBlockProvider({
  code,
  language,
  totalLines,
  children,
}: CodeBlockProviderProps) {
  const configStore = useConfigStoreState();
  const { wrapline, showFullCode } = useConfigStore(
    useShallow((state) => ({
      wrapline: state.wrapline,
      showFullCode: state.showFullCode,
    })),
  );

  const [expanded, setExpanded] = useState(showFullCode);
  const [containerHeightPx, setContainerHeightPx] = useState<number>(0);

  return (
    <CodeBlockContext.Provider
      value={{
        code,
        language,
        totalLines,
        expanded,
        setExpanded,
        wrapline,
        toggleWrapline: configStore.toggleWrapline,
        containerHeightPx,
        setContainerHeightPx,
      }}
    >
      {children}
    </CodeBlockContext.Provider>
  );
}
