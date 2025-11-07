import { defineCollection, z } from "astro:content";

const log = defineCollection({
  type: "content",
  schema: z.object({
    date: z.string(),           // "2025-11-06"
    text: z.string(),
    image: z.string().optional() // "images/LOGO.jpg"
  }),
});

const releases = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    page: z.string().url().optional(),
    download: z.string().url().optional(),
    vinyl: z.string().url().optional(),
    cd: z.string().url().optional(),
    cassette: z.string().url().optional(),
  }),
});

const art = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    image: z.string(),         // "images/ART 1.jpg"
    preview: z.string().url().optional(),
    buy: z.string().url().optional(),
  }),
});

export const collections = { log, releases, art };
