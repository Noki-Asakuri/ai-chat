import type { ExtraProps } from "streamdown";

type InlineCodeBlockProps = React.ComponentProps<"code"> & ExtraProps;

export function InlineCodeBlock({ children, ...props }: InlineCodeBlockProps) {
  return (
    <code
      {...props}
      data-slot="inline-codeblock"
      className="relative rounded border border-red-200 bg-muted/40 px-[0.3rem] py-[0.2rem] text-[0.80em] wrap-anywhere before:content-[''] after:content-['']"
    >
      {children}
    </code>
  );
}
