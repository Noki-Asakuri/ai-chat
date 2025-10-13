"use client";

import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { AllModelIds, getModelData, prettifyProviderName } from "@/lib/chat/models";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Models</h2>
        <p className="text-muted-foreground">
          Choose which models are visible in the model picker.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Search models</Label>
        <Input disabled className="bg-input/30" />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="rounded-md">
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-sm" />
                <div className="space-y-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Button disabled>Save</Button>
        <Button disabled variant="outline">
          Reset
        </Button>
      </div>
    </div>
  );
}

export default function ModelsPage() {
  const { data, isPending } = useQuery(convexQuery(api.functions.users.currentUser, {}));
  const updateCustomization = useMutation(api.functions.users.updateUserCustomization);

  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [localHidden, setLocalHidden] = useState<string[]>([]);

  useEffect(() => {
    setLocalHidden(data?.customization?.hiddenModels ?? []);
  }, [data?.customization?.hiddenModels]);

  const list = useMemo(() => {
    return AllModelIds.slice()
      .sort((a, b) => a.localeCompare(b))
      .filter((id) => {
        const d = getModelData(id);
        const text = `${d.display.unique ?? d.display.name} ${d.provider}`.toLowerCase();
        return text.includes(query.trim().toLowerCase());
      });
  }, [query]);

  if (isPending || !data) return <LoadingSkeleton />;

  function isHidden(id: string) {
    return localHidden.includes(id);
  }
  function setHidden(id: string, hidden: boolean) {
    setLocalHidden((prev) => {
      if (hidden) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  }

  function onSave() {
    startTransition(async () => {
      toast.promise(updateCustomization({ data: { hiddenModels: localHidden } }), {
        loading: "Saving preferences...",
        success: "Preferences saved",
        error: "Failed to save preferences",
      });
    });
  }

  function onReset() {
    setLocalHidden([]);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Models</h2>
        <p className="text-muted-foreground">
          Choose which models are visible in the model picker.
        </p>
      </div>

      {/* Sticky header with search + save actions */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-end gap-2 border-b pt-2 pb-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="model-search">Search models</Label>
            <Input
              id="model-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or provider…"
              className="bg-input/30 outline-none"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 pb-[2px]">
            <Button onClick={onSave} disabled={pending}>
              Save
            </Button>
            <Button onClick={onReset} variant="outline" disabled={pending}>
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable models grid stays under the sticky controls */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {list.map((id) => {
          const d = getModelData(id);
          const providerName = prettifyProviderName(d.provider);
          const hidden = isHidden(id);

          return (
            <Card key={id} className="rounded-md">
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-2">
                  <Icons.provider provider={d.provider} className="size-5" />
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm">{d.display.unique ?? d.display.name}</span>
                    <span className="text-xs text-muted-foreground">{providerName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs">{hidden ? "Hidden" : "Visible"}</span>
                  <Switch
                    checked={!hidden}
                    onCheckedChange={(v) => setHidden(id, !v)}
                    aria-label={`Toggle visibility for ${d.display.unique ?? d.display.name}`}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
