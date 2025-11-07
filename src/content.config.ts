import { defineCollection, z } from "astro:content";

const log = defineCollection({
  type: "content",
  schema: z.object({
    date: z.string(),             // "2025-11-06"
    text: z.string(),             // short log text
    image: z.string().optional(), // "/images/foo.png"
  }),
});

const releases = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    page: z.string().optional(),     // (was .url())
    download: z.string().optional(), // (was .url())
    vinyl: z.string().optional(),    // (was .url())
    cd: z.string().optional(),       // (was .url())
    cassette: z.string().optional(), // (was .url())
    cover: z.string().optional(),    // "/images/cover.jpg"
  }),
});

const art = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    preview: z.string().optional(),  // (was .url())
    buy: z.string().optional(),      // (was .url())
    image: z.string().optional(),    // "/images/art.jpg"
  }),
});

export const collections = { log, releases, art };
