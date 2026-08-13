import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export function LoadingCustomizationSkeleton() {
  return (
    <form>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-5 py-4">
          <CardTitle>Personal context</CardTitle>
          <CardDescription>
            Give the assistant a small amount of context it can use in every conversation.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <FieldGroup className="gap-0">
            <Field className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] md:gap-8">
              <FieldContent>
                <FieldLabel>What should AI call you?</FieldLabel>
                <FieldDescription>Your preferred name or nickname.</FieldDescription>
              </FieldContent>
              <Input disabled className="h-10 bg-input/30 text-sm" placeholder="Enter your name" />
            </Field>

            <Separator />

            <Field className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] md:gap-8">
              <FieldContent>
                <FieldLabel>Global instruction</FieldLabel>
                <FieldDescription>
                  Applied to every new conversation unless a profile provides more specific guidance.
                </FieldDescription>
              </FieldContent>
              <Textarea disabled className="min-h-48 bg-input/30" />
            </Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className="justify-between gap-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">Changes save automatically.</p>
          <Skeleton className="h-5 w-16 rounded-md" />
        </CardFooter>
      </Card>
    </form>
  );
}
