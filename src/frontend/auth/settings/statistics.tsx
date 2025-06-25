"use client";

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";

import { NavLink } from "react-router";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";

import { getModelData } from "@/lib/chat/models";
import { format, toUUID } from "@/lib/utils";

type StatItem = {
  name: string;
  value: number;
};

type RankItem = {
  id: string;
  name: string;
  value: number;
};

type StatisticsData = {
  stats: StatItem[];
  modelRank: RankItem[];
  threadRank: RankItem[];
};

export function StatisticsPage() {
  const statistics = useQuery(api.statistics.getStatistics) as StatisticsData | undefined;

  if (!statistics) {
    return (
      <main className="space-y-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </CardHeader>

              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-1 h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-1 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-6 w-40" />
              <div className="mt-4 flex text-gray-500">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
              <div className="mt-2 space-y-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex justify-between">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  const { stats, modelRank, threadRank } = statistics;

  return (
    <main className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {stats.map((item) => (
          <Card key={item.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-normal text-gray-400">{item.name}</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="text-3xl font-bold">{format.number(item.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold">Activity in the past year</h2>
        </div>
        <div className="mt-4">
          <div className="flex justify-end text-xs text-gray-500">
            {[
              "Jul",
              "Aug",
              "Sep",
              "Oct",
              "Nov",
              "Dec",
              "Jan",
              "Feb",
              "Mar",
              "Apr",
              "May",
              "Jun",
            ].map((month) => (
              <div key={month} className="w-[calc(100%/12)] text-center">
                {month}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-flow-col grid-rows-7 gap-1">
            {Array.from({ length: 365 }).map((_, i) => (
              <div
                key={i}
                className="size-3 rounded-sm bg-gray-800"
                style={{
                  backgroundColor: `rgba(52, 211, 153, ${Math.random() > 0.3 ? Math.random() : 0})`,
                }}
              />
            ))}
          </div>

          <div className="mt-2 flex justify-between">
            <p className="text-xs text-gray-500">A total of 1611 messages sent in the past year</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <p>Inactive</p>
              <div className="size-3 rounded-sm bg-green-900" />
              <div className="size-3 rounded-sm bg-green-700" />
              <div className="size-3 rounded-sm bg-green-500" />
              <div className="size-3 rounded-sm bg-green-300" />
              <p>Active</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-1 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Model Usage Rank</h2>
          <div className="mt-4 flex text-gray-500">
            <p className="w-2/3">Model</p>
            <p className="w-1/3 text-right">Messages</p>
          </div>
          <div className="mt-2 space-y-2">
            {modelRank.slice(0, 5).map((item) => (
              <ModelRank key={item.name} model={item} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold">Thread Content Rank</h2>
          <div className="mt-4 flex text-gray-500">
            <p className="w-2/3">Thread</p>
            <p className="w-1/3 text-right">Messages</p>
          </div>

          <div className="mt-2 space-y-2">
            {threadRank.slice(0, 5).map((item) => (
              <NavLink to={`/chat/${toUUID(item.id)}`} key={item.id}>
                <div className="flex justify-between gap-4 rounded-md px-4 py-2 hover:bg-gray-800/50">
                  <p className="truncate">{item.name}</p>

                  <span>{item.value}</span>
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function ModelRank({ model }: { model: RankItem }) {
  const modelData = getModelData(model.name);

  return (
    <div className="flex justify-between gap-4 rounded-md px-4 py-2 hover:bg-gray-800/50">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Icons.provider provider={modelData.provider} />
          <p>{modelData.displayName}</p>
        </div>
        <span className="text-xs">{model.name}</span>
      </div>

      <p>{model.value}</p>
    </div>
  );
}
