import path from "path";
import { Font } from "@react-pdf/renderer";

let FONTS_REGISTERED = false;

export function ensurePdfFontsRegistered() {
  if (FONTS_REGISTERED) return;

  const fontsDir = path.join(process.cwd(), "public", "fonts");

  Font.register({
    family: "Inter",
    fonts: [
      {
        src: path.join(fontsDir, "Inter-Regular.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(fontsDir, "Inter-SemiBold.ttf"),
        fontWeight: 600,
      },
      {
        src: path.join(fontsDir, "Inter-Bold.ttf"),
        fontWeight: 700,
      },
    ],
  });

  Font.register({
    family: "Playfair",
    fonts: [
      {
        src: path.join(fontsDir, "PlayfairDisplay-Regular.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(fontsDir, "PlayfairDisplay-SemiBold.ttf"),
        fontWeight: 600,
      },
      {
        src: path.join(fontsDir, "PlayfairDisplay-Bold.ttf"),
        fontWeight: 700,
      },
    ],
  });

  // Disable automatic word hyphenation so Portuguese words don't get broken weirdly
  Font.registerHyphenationCallback((word) => [word]);

  FONTS_REGISTERED = true;
}
