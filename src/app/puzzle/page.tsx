import fs from "fs";
import path from "path";
import PuzzleClient from "./PuzzleClient";

/**
 * Server Component — reads /public/puzzles/ directory on each request.
 * Just drop new images into public/puzzles/ and they will auto-appear!
 */
export const dynamic = "force-dynamic";

export default function PuzzlePage() {
  const puzzlesDir = path.join(process.cwd(), "public", "puzzles");

  let images: string[] = [];
  try {
    images = fs
      .readdirSync(puzzlesDir)
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort()
      .map((f) => `/puzzles/${f}`);
  } catch {
    // Directory might not exist yet — that's OK
  }

  return <PuzzleClient images={images} />;
}
