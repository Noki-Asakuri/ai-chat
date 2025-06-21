import { cn } from "@/lib/utils";

export function TypographyP({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("leading-7 [&:not(:first-child)]:mt-4 [&:not(:last-child)]:mb-4", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function TypographyH1({ className, children, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

export function TypographyH2({ className, children, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function TypographyH3({ className, children, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3 className={cn("scroll-m-20 text-2xl font-semibold tracking-tight", className)} {...props}>
      {children}
    </h3>
  );
}

export function TypographyH4({ className, children, ...props }: React.ComponentProps<"h4">) {
  return (
    <h4
      className={cn("text-foreground scroll-m-20 text-xl font-semibold tracking-tight", className)}
      {...props}
    >
      {children}
    </h4>
  );
}

export function TypographyBlockquote({
  className,
  children,
  ...props
}: React.ComponentProps<"blockquote">) {
  return (
    <blockquote className={cn("mt-4 border-l-2 pl-6 italic", className)} {...props}>
      {children}
    </blockquote>
  );
}

export function TypographyUnorderedList({ children }: React.ComponentProps<"ul">) {
  return (
    <ul className="ml-6 list-disc [&>li]:my-2 [&>li:first-child]:mt-4 [&>li:last-child]:mb-4">
      {children}
    </ul>
  );
}

export function TypographyOrderedList({ children }: React.ComponentProps<"ul">) {
  return (
    <ol className="ml-6 list-decimal [&>li]:my-2 [&>li:first-child]:mt-4 [&>li:last-child]:mb-4">
      {children}
    </ol>
  );
}

export function TypographyInlineCode({ children }: React.ComponentProps<"code">) {
  return (
    <code className="bg-muted/40 relative rounded border px-[0.3rem] py-[0.2rem] text-[0.80em] before:content-[''] after:content-['']">
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
    <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
      {children}
    </td>
  );
}
