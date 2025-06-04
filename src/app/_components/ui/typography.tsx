export function TypographyP({ children }: React.ComponentProps<"p">) {
  return <p className="leading-7 [&:not(:first-child)]:mt-6 [&:not(:last-child)]:mb-6">{children}</p>;
}

export function TypographyH1({ children }: React.ComponentProps<"h1">) {
  return <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance">{children}</h1>;
}

export function TypographyH2({ children }: React.ComponentProps<"h1">) {
  return <h2 className="scroll-m-20 border-b pb-6 text-3xl font-semibold tracking-tight first:mt-0">{children}</h2>;
}

export function TypographyH3({ children }: React.ComponentProps<"h1">) {
  return <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">{children}</h3>;
}

export function TypographyH4({ children }: React.ComponentProps<"h1">) {
  return <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">{children}</h4>;
}

export function TypographyBlockquote({ children }: React.ComponentProps<"blockquote">) {
  return <blockquote className="mt-6 border-l-2 pl-6 italic">{children}</blockquote>;
}

export function TypographyUnorderedList({ children }: React.ComponentProps<"ul">) {
  return <ul className="my-6 ml-6 list-disc [&>li]:mt-2">{children}</ul>;
}

export function TypographyOrderedList({ children }: React.ComponentProps<"ul">) {
  return <ol className="my-6 ml-6 list-decimal [&>li]:mt-2">{children}</ol>;
}

export function TypographyInlineCode({ children }: React.ComponentProps<"code">) {
  return (
    <code className="bg-muted/40 relative rounded border px-[0.3rem] py-[0.2rem] text-[0.85em] before:content-[''] after:content-['']">
      {children}
    </code>
  );
}

export function TypographySmall({ children }: React.ComponentProps<"small">) {
  return <small className="text-sm leading-none font-medium">{children}</small>;
}

export function TypographyTable({ children }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-y-auto">
      <table className="!my-0">{children}</table>
    </div>
  );
}

export function TypographyTableTHead({ children }: React.ComponentProps<"thead">) {
  return <thead className="*:!bg-transparent">{children}</thead>;
}

export function TypographyTableTR({ children }: React.ComponentProps<"tr">) {
  return <tr className="odd:bg-muted m-0 border-t p-0">{children}</tr>;
}

export function TypographyTableTH({ children }: React.ComponentProps<"th">) {
  return (
    <th className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right">
      {children}
    </th>
  );
}

export function TypographyTableTD({ children }: React.ComponentProps<"td">) {
  return (
    <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">{children}</td>
  );
}
