type InlineCodeBlockProps = React.ComponentProps<"code"> & { language: string; code: string };

export function InlineCodeBlock({ code, language, ...props }: InlineCodeBlockProps) {
  return (
    <code
      {...props}
      data-slot="inline-codeblock"
      data-language={language}
      className="relative rounded border bg-muted/40 px-[0.3rem] py-[0.2rem] text-[0.80em] wrap-anywhere before:content-[''] after:content-['']"
    >
      {code}
    </code>
  );
}
