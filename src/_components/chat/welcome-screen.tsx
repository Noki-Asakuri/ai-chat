import { useUser } from "@clerk/react-router";
import { BookOpenIcon, CodeIcon, CompassIcon, SparklesIcon } from "lucide-react";
import { useParams } from "react-router";

import { Tab, Tabs, TabsList, TabsPanel } from "../ui/tabs";

import { useChatStore } from "@/lib/chat/store";

interface CategoryButton {
  icon: React.ComponentType<{ className?: string }>;
  topic: string;
  prompts: string[];
}

const createPrompts = [
  "Give me 5 creative writing prompts for flash fiction",
  "Write a short story about a robot discovering emotions",
  "Help me outline a sci-fi novel set in a post-apocalyptic world",
  "Create a character profile for a complex villain with sympathetic motives",
];

const explorePrompts = [
  "Tell me about the history of the Silk Road.",
  "Explain the theory of relativity in simple terms.",
  "What are the latest discoveries in space exploration?",
  "What are some of the most mysterious places on Earth?",
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
  "What are the fundamentals of financial literacy?",
  "Summarize the main ideas of 'Sapiens' by Yuval Noah Harari.",
];

const categories: CategoryButton[] = [
  { icon: SparklesIcon, topic: "create", prompts: createPrompts },
  { icon: CompassIcon, topic: "explore", prompts: explorePrompts },
  { icon: CodeIcon, topic: "code", prompts: codePrompts },
  { icon: BookOpenIcon, topic: "learn", prompts: learnPrompts },
];

export function WelcomeScreen() {
  const { user } = useUser();
  const { threadId } = useParams<{ threadId: string }>();

  const chatInput = useChatStore((state) => state.chatInput.length);
  const textareaHeight = useChatStore((state) => state.textareaHeight);

  const handlePromptClick = (prompt: string) => {
    useChatStore.getState().setChatInput(prompt);

    setTimeout(() => {
      const textarea = document.getElementById("textarea-chat-input");
      textarea?.focus();
    }, 100);
  };

  if (chatInput > 0 || !!threadId) return null;

  return (
    <div
      id="welcome-screen"
      style={{ height: `calc(100% - ${textareaHeight}px)` }}
      className="pointer-events-none absolute flex w-full flex-col items-center justify-center transition-opacity"
    >
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="font-light text-4xl text-foreground">
          How can I help you, <span className="capitalize">{user?.username}</span>?
        </h1>

        <div className="w-full px-4 md:min-w-[650px]">
          <Tabs defaultValue="create">
            <TabsList className="pointer-events-auto z-10 w-full bg-muted/70 backdrop-blur-md backdrop-saturate-150 group-data-[disable-blur=true]/sidebar-provider:bg-muted">
              {categories.map((category) => (
                <Tab key={category.topic} value={category.topic} className="h-10">
                  <category.icon className="size-4" />
                  <span className="capitalize">{category.topic}</span>
                </Tab>
              ))}
            </TabsList>

            {categories.map((category) => (
              <TabsPanel key={category.topic} value={category.topic} className="z-10">
                <div className="grid grid-cols-1 gap-1">
                  {category.prompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handlePromptClick(prompt)}
                      className="pointer-events-auto flex items-center justify-center text-pretty rounded-md bg-muted/70 px-4 py-2 text-sm backdrop-blur-md backdrop-saturate-150 transition-colors hover:bg-muted/40 group-data-[disable-blur=true]/sidebar-provider:bg-muted hover:group-data-[disable-blur=true]/sidebar-provider:bg-muted/80 md:min-w-max md:justify-start md:text-base"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </TabsPanel>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
