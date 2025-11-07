import { defineCollection, z } from "astro:content";

const log = defineCollection({
  type: "content",
  schema: z.object({
    date: z.string(),                // e.g. "2025-11-06"
    text: z.string(),                // short text to show in the log
    image: z.string().optional(),    // e.g. "/images/foo.png" (optional)
  }),
});

const releases = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    page: z.string().url().optional(),     // details page or external link
    download: z.string().url().optional(), // direct free DL (zip, etc.)
    vinyl: z.string().url().optional(),
    cd: z.string().url().optional(),
    cassette: z.string().url().optional(),
    cover: z.string().optional(),          // e.g. "/images/release.jpg"
  }),
});

const art = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    preview: z.string().url().optional(),
    buy: z.string().url().optional(),
    image: z.string().optional(),          // e.g. "/images/art.jpg"
  }),
});

export const collections = { log, releases, art };
