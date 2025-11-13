import { defineCollection, z } from "astro:content";

const log = defineCollection({
  type: "content",
  schema: z.object({
    date: z.string(),            // e.g. "2025-11-06"
    text: z.string(),
    image: z.string().optional() // e.g. "images/LOGO.jpg"
  }),
});

const releases = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    cover: z.string().optional(),            // e.g. "images/protocol-001.jpg"
    tracks: z.array(z.string()).default([]), // e.g. ["releases/protocol-001.mp3"]
    readme: z.string().optional(),           // e.g. "releases/protocol-001_README.txt"
    order: z.number().optional(),            // manual ordering (1 = newest/top, etc.)
  }),
});

const art = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    image: z.string(),                        // e.g. "images/ART-1.jpg"
    preview: z.string().url().optional(),
    buy: z.string().url().optional(),
  }),
});

export const collections = { log, releases, art };
