import fs from "fs";
import path from "path";
import { Font } from "@react-pdf/renderer";

let FONTS_REGISTERED = false;

function resolveFontSource(fileName: string, assetsBaseUrl?: string): string {
  const candidates = [
    path.join(
      process.cwd(),
      "src",
      "components",
      "reports",
      "pdf",
      "fonts",
      fileName
    ),
    path.join(process.cwd(), "public", "fonts", fileName),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore fs errors in restricted runtimes
    }
  }

  const base = (assetsBaseUrl || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/fonts/${fileName}`;
}

export function ensurePdfFontsRegistered(assetsBaseUrl?: string) {
  if (FONTS_REGISTERED) return;

  Font.register({
    family: "Inter",
    fonts: [
      {
        src: resolveFontSource("Inter-Regular.ttf", assetsBaseUrl),
        fontWeight: 400,
      },
      {
        src: resolveFontSource("Inter-SemiBold.ttf", assetsBaseUrl),
        fontWeight: 600,
      },
      {
        src: resolveFontSource("Inter-Bold.ttf", assetsBaseUrl),
        fontWeight: 700,
      },
    ],
  });

  Font.registerHyphenationCallback((word) => [word]);

  FONTS_REGISTERED = true;
}
