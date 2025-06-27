import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Customize AI</h2>
        <p className="text-muted-foreground">
          Customize the assistant's personality to your liking.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2 px-2">
          <Label>What should AI call you?</Label>
          <Input disabled className="bg-input/30" />
        </div>

        <div className="space-y-2 px-2">
          <Label>What do you do?</Label>
          <Input disabled className="bg-input/30" />
        </div>

        <div className="space-y-2 px-2">
          <Label>What traits should AI have?</Label>
          <Input disabled className="bg-input/30" />
        </div>

        <div className="space-y-2 px-2">
          <Label>System instruction (Global)</Label>
          <Textarea disabled className="bg-input/30 min-h-[200px]" />
        </div>

        <Button disabled>Save Preferences</Button>
      </div>
    </div>
  );
}

export function CustomizePage() {
  const data = useQuery(api.users.currentUser);
  const update = useMutation(api.users.updateUserCustomization);

  const [pending, startTransition] = useTransition();

  function updateUserCustomization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = (formData.get("name") ?? "") as string;
    const occupation = (formData.get("occupation") ?? "") as string;
    const traits = (formData.get("traits") ?? "") as string;
    const systemInstruction = (formData.get("system-instruction") ?? "") as string;

    startTransition(async function () {
      const updates = {
        name,
        occupation,
        traits: traits?.split(",").map((t) => t.trim()),
        systemInstruction,
      };

      toast.promise(update({ data: updates }), {
        loading: "Saving preferences...",
        success: "Preferences saved",
        error: "Failed to save preferences",
      });
    });
  }

  if (!data) return <LoadingSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Customize AI</h2>
        <p className="text-muted-foreground">
          Customize the assistant's personality to your liking.
        </p>
      </div>

      <form className="space-y-4" onSubmit={updateUserCustomization}>
        <div className="space-y-2 px-2">
          <Label htmlFor="name">What should AI call you?</Label>
          <Input
            id="name"
            name="name"
            autoComplete="off"
            placeholder="Enter your name"
            className="bg-input/30"
            disabled={pending}
            defaultValue={data?.customization?.name ?? ""}
          />
        </div>

        <div className="space-y-2 px-2">
          <Label htmlFor="occupation">What do you do?</Label>
          <Input
            id="occupation"
            name="occupation"
            autoComplete="off"
            placeholder="Engineer, student, etc."
            className="bg-input/30"
            disabled={pending}
            defaultValue={data?.customization?.occupation ?? ""}
          />
        </div>

        <div className="space-y-2 px-2">
          <Label htmlFor="traits">What traits should AI have?</Label>
          <Input
            id="traits"
            name="traits"
            autoComplete="off"
            placeholder="Type a trait and press Enter or Tab..."
            className="bg-input/30"
            disabled={pending}
            defaultValue={data?.customization?.traits?.join(", ") ?? ""}
          />
        </div>

        <div className="space-y-2 px-2">
          <Label htmlFor="system-instruction">System instruction (Global)</Label>
          <Textarea
            autoComplete="off"
            id="system-instruction"
            name="system-instruction"
            className="min-h-[200px]"
            disabled={pending}
            defaultValue={data?.customization?.systemInstruction ?? "You are a helpful assistant."}
          />
        </div>

        <Button type="submit" disabled={pending}>
          Save Preferences
        </Button>
      </form>
    </div>
  );
}
