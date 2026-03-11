// scripts/generate-icons.ts
import sharp from "sharp";
import path from "path";

// Assuming your master file is the 1024 version
const SOURCE_ICON = "icon-1024.png";
const OUTPUT_DIR = "./public";

type IconConfig = {
  name: string;
  size: number;
};

const targets: IconConfig[] = [
  { name: "favicon.ico", size: 32 }, // simplified ico generation
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-256.png", size: 256 },
  { name: "icon-512.png", size: 512 },
];

async function generateIcons() {
  console.log(`Generating icons from ${SOURCE_ICON}...`);

  for (const target of targets) {
    await sharp(`./public/${SOURCE_ICON}`)
      .resize(target.size, target.size)
      .toFile(path.join(OUTPUT_DIR, target.name));

    console.log(`Created ${target.name} (${target.size}x${target.size})`);
  }
}

generateIcons().catch(console.error);
