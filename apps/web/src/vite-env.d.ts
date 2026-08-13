/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

type LocalFontData = {
  family: string;
  fullName: string;
  postscriptName: string;
  style: string;
};

interface Window {
  queryLocalFonts?: () => Promise<LocalFontData[]>;
}

declare module "lucide-react" {
  export * from "lucide-react/dist/lucide-react.suffixed";
}
