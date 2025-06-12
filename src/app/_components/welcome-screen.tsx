"use client";

import { BookOpenIcon, CodeIcon, CompassIcon, SparklesIcon } from "lucide-react";
import { useUser } from "@clerk/nextjs";

import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

import { useChatStore } from "@/lib/chat/store";
import { cn } from "@/lib/utils";

interface CategoryButton {
  icon: React.ComponentType<{ className?: string }>;
  topic: string;
  prompts: string[];
}

const createPrompts = [
  "Write a short story about a robot discovering emotions",
  "Help me outline a sci-fi novel set in a post-apocalyptic world",
  "Create a character profile for a complex villain with sympathetic motives",
  "Give me 5 creative writing prompts for flash fiction",
];

const explorePrompts = [
  "What are the latest discoveries in space exploration?",
  "Tell me about the history of the Silk Road.",
  "What are some of the most mysterious places on Earth?",
  "Explain the theory of relativity in simple terms.",
];

const codePrompts = [
  "Write a Python script to scrape a website.",
  "How do I set up a React project with Next.js?",
  "Explain the difference between SQL and NoSQL databases.",
  "Generate a function to calculate the factorial of a number in JavaScript.",
];

const learnPrompts = [
  "Teach me the basics of machine learning.",
  "How can I improve my public speaking skills?",
  "Summarize the main ideas of 'Sapiens' by Yuval Noah Harari.",
  "What are the fundamentals of financial literacy?",
];

const categories: CategoryButton[] = [
  { icon: SparklesIcon, topic: "Create", prompts: createPrompts },
  { icon: CompassIcon, topic: "Explore", prompts: explorePrompts },
  { icon: CodeIcon, topic: "Code", prompts: codePrompts },
  { icon: BookOpenIcon, topic: "Learn", prompts: learnPrompts },
];

export function WelcomeScreen() {
  const { user } = useUser();

  const threadId = useChatStore((state) => state.threadId);
  const chatInput = useChatStore((state) => state.chatInput.length);
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const setChatInput = useChatStore((state) => state.setChatInput);

  const handlePromptClick = (prompt: string) => {
    setChatInput(prompt);
    // Focus the textarea after setting the input
    setTimeout(() => {
      const textarea = document.getElementById("textarea-chat-input");
      textarea?.focus();
    }, 100);
  };

  return (
    <div
      style={{ height: `calc(100% - ${textareaHeight}px)` }}
      id="welcome-screen"
      className={cn(
        "pointer-events-auto absolute z-40 flex w-full flex-col items-center justify-center opacity-100 transition-opacity",
        { "pointer-events-none opacity-0": chatInput > 0 || !!threadId },
      )}
    >
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-foreground text-4xl font-light">
          How can I help you, <span className="capitalize">{user?.username}</span>?
        </h1>

        <Tabs defaultValue="Create" className="w-full md:w-[600px]">
          <TabsList className="w-full">
            {categories.map((category) => (
              <TabsTrigger key={category.topic} value={category.topic} className="cursor-pointer">
                <category.icon className="size-4" />
                {category.topic}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category.topic} value={category.topic}>
              <div className="grid grid-cols-1 gap-2 pt-4">
                {category.prompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handlePromptClick(prompt)}
                    className="hover:bg-muted/40 flex cursor-pointer items-center justify-start rounded-md px-4 py-2 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/*

        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
          {categories
            .flatMap((category) => category.prompts)
            .map((prompt, index) => (
              <button
                key={index}
                onClick={() => handlePromptClick(prompt)}
                className="text-muted-foreground hover:text-foreground block w-full rounded-lg bg-zinc-50/50 px-4 py-3 text-left text-base transition-colors dark:bg-zinc-900/50"
              >
                {prompt}
              </button>
            ))}
        </div> */}
      </div>
    </div>
  );
}
