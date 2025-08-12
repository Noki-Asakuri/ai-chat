declare module "lucide-react" {
  export * from "lucide-react/dist/lucide-react.suffixed";
}

declare module "*.css" {
  const content: string;
  export default content;
}
