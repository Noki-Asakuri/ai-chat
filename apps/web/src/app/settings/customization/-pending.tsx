import { SettingsSection } from "@/components/settings/settings-section";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export function LoadingCustomizationSkeleton() {
  return (
    <form>
      <SettingsSection
        id="personal-context"
        title="Personal context"
        description="Give the assistant a small amount of context it can use in every conversation."
        actions={<Skeleton className="h-5 w-16 rounded-md" />}
      >
        <FieldGroup className="gap-0">
          <Field className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)] md:gap-x-8">
            <FieldContent>
              <FieldLabel>What should AI call you?</FieldLabel>
              <FieldDescription>Your preferred name or nickname.</FieldDescription>
            </FieldContent>
            <Input disabled className="h-10 bg-input/30 text-sm" placeholder="Enter your name" />
          </Field>

          <Separator />

          <Field className="grid gap-4 py-5 md:grid-cols-[minmax(12rem,0.7fr)_minmax(18rem,1fr)] md:gap-x-8">
            <FieldContent>
              <FieldLabel>Global instruction</FieldLabel>
              <FieldDescription>
                Applied to every new conversation unless a profile provides more specific guidance.
              </FieldDescription>
            </FieldContent>
            <Textarea disabled className="min-h-48 bg-input/30" />
          </Field>
        </FieldGroup>
        <p className="border-t pt-4 text-xs text-muted-foreground">Changes save automatically.</p>
      </SettingsSection>
    </form>
  );
}
