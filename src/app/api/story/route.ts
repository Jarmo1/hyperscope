import { NextResponse } from "next/server";
import { pickStory } from "@/lib/story";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * The scheduler's data source. Returns the current most postable fact plus a
 * stable key; deciding whether it has already been posted is the caller's job,
 * which keeps this endpoint stateless and free to run.
 */
export async function GET() {
  try {
    const story = await pickStory();

    if (!story) {
      return NextResponse.json(
        { story: null, reason: "Nothing above the newsworthiness threshold." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const url = `${siteUrl()}${story.path}`;

    return NextResponse.json(
      {
        story: {
          kind: story.kind,
          key: story.key,
          text: story.text,
          url,
          // Posting the card as media gets far more engagement than a link
          // preview, so hand the scheduler a direct image URL too.
          image: `${url}/opengraph-image`,
        },
        generatedAt: Date.now(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { story: null, error: error instanceof Error ? error.message : "unknown" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
