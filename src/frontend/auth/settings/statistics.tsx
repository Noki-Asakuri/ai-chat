"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  {
    name: "Assistants",
    value: "12",
    change: "+9.1%",
    previous: "11 Last Month",
  },
  {
    name: "Topics",
    value: "399",
    change: "+3.1%",
    previous: "387 Last Month",
  },
  {
    name: "Messages",
    value: "1,741",
    change: "+1.8%",
    previous: "1,710 Last Month",
  },
  {
    name: "Total Words",
    value: "2.8M",
    change: "+4.6%",
    previous: "2.6M Last Month",
  },
];

const modelRank = [
  { name: "chagpt-4o-latest", value: 242 },
  { name: "qpt-4o", value: 172 },
  { name: "o1-preview", value: 69 },
  { name: "qpt-4.1", value: 59 },
  { name: "o4-mini", value: 49 },
];

const assistantRank = [
  { name: "Just Chat", value: 215 },
  { name: "O3 Mini High", value: 37 },
  { name: "Gemini", value: 35 },
  { name: "OpenAI GPT", value: 28 },
  { name: "Writing Assistant", value: 27 },
];

const topicRank = [
  { name: "UUID based AES encrypti...", value: 36 },
  { name: "Handling template literal...", value: 28 },
  { name: "Check substring in char a...", value: 24 },
  { name: "Lazily load and read file i...", value: 20 },
  { name: "Sorting SQL by article co...", value: 20 },
];

export function StatisticsPage() {
  return (
    <main className="space-y-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-normal text-gray-400">{item.name}</CardTitle>
              <div className="rounded-md bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                {item.change}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{item.value}</div>
              <p className="text-xs text-gray-500">{item.previous}</p>
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

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-1 lg:grid-cols-3">
        <div>
          <h2 className="text-xl font-semibold">Model Usage Rank</h2>
          <div className="mt-4 flex text-gray-500">
            <p className="w-2/3">Model</p>
            <p className="w-1/3 text-right">Messages</p>
          </div>
          <div className="mt-2 space-y-2">
            {modelRank.map((item) => (
              <div key={item.name} className="flex justify-between">
                <p>{item.name}</p>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Assistant Usage Rank</h2>
          <div className="mt-4 flex text-gray-500">
            <p className="w-2/3">Assistant</p>
            <p className="w-1/3 text-right">Topics</p>
          </div>
          <div className="mt-2 space-y-2">
            {assistantRank.map((item) => (
              <div key={item.name} className="flex justify-between">
                <p>{item.name}</p>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Topic Content Rank</h2>
          <div className="mt-4 flex text-gray-500">
            <p className="w-2/d">Topic</p>
            <p className="w-1/3 text-right">Messages</p>
          </div>
          <div className="mt-2 space-y-2">
            {topicRank.map((item) => (
              <div key={item.name} className="flex justify-between">
                <p className="truncate">{item.name}</p>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
