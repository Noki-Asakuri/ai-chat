import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

import { useUser } from "@clerk/react-router";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

      await toast
        .promise(update({ data: updates }), {
          loading: "Saving preferences...",
          success: "Preferences saved",
          error: "Failed to save preferences",
        })
        .unwrap();
    });
  }

  if (!data) return <Loading />;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Customize AI</h2>
        <p className="text-muted-foreground">
          Customize the assistant's personality to your liking.
        </p>
      </div>

      <form className="space-y-4" onSubmit={updateUserCustomization}>
        <div className="space-y-2">
          <Label htmlFor="name">What should AI call you?</Label>
          <Input
            id="name"
            name="name"
            placeholder="Enter your name"
            className="bg-input/30"
            disabled={pending}
            defaultValue={data?.customization?.name ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="occupation">What do you do?</Label>
          <Input
            id="occupation"
            name="occupation"
            placeholder="Engineer, student, etc."
            className="bg-input/30"
            disabled={pending}
            defaultValue={data?.customization?.occupation ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="traits">What traits should AI have?</Label>
          <Input
            id="traits"
            name="traits"
            placeholder="Type a trait and press Enter or Tab..."
            className="bg-input/30"
            disabled={pending}
            defaultValue={data?.customization?.traits?.join(", ") ?? ""}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="system-instruction">System instruction (Global)</Label>
          <Textarea
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

function Loading() {
  return <div className="flex h-full w-full flex-1 items-center justify-center">Loading...</div>;
}
