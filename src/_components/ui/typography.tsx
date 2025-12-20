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
        "scroll-m-20 text-center text-3xl font-extrabold tracking-tight text-balance",
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
      className={cn("scroll-m-20 text-xl font-semibold tracking-tight text-foreground", className)}
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
    <blockquote
      {...props}
      className={cn("mt-4 border-l-4 border-card-foreground bg-card py-2.5 pl-4", className)}
    >
      {children}
    </blockquote>
  );
}

export function TypographyInlineCode({ children }: React.ComponentProps<"code">) {
  return (
    <code className="relative rounded border bg-muted/40 px-[0.3rem] py-[0.2rem] text-[0.80em] before:content-[''] after:content-['']">
      {children}
    </code>
  );
}

export function TypographyTable({ children }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-hidden rounded-md border">
      <table className="w-full">{children}</table>
    </div>
  );
}

export function TypographyTableTHead({ children, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead {...props} className="bg-muted">
      {children}
    </thead>
  );
}

export function TypographyTableTR({ children }: React.ComponentProps<"tr">) {
  return <tr className="m-0 p-0 transition-colors hover:bg-muted/40">{children}</tr>;
}

export function TypographyTableTH({ children, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      {...props}
      className={cn(
        "px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
        props.className,
      )}
    >
      {children}
    </th>
  );
}

export function TypographyTableTD({ children }: React.ComponentProps<"td">) {
  return (
    <td className="px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
      {children}
    </td>
  );
}
