import { defineCollection, z } from "astro:content";

const log = defineCollection({
  type: "content",
  schema: z.object({
    date: z.string(),
    text: z.string(),
    image: z.string().optional(),
  }),
});

const releases = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    cover: z.string().optional(),        // "images/foo.jpg"
    readme: z.string().optional(),       // "releases/foo_README.txt"
    tracks: z.array(z.string()).default([]), // ["releases/foo.mp3"]
    order: z.number().optional(),        // optional sorting index
  }),
});

const art = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    image: z.string(),
    preview: z.string().optional(),
    buy: z.string().optional(),
  }),
});

export const collections = { log, releases, art };
