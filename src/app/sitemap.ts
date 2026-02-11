import { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://content-pipeline-sage.vercel.app";
  const slugs = await getAllSlugs();

  const postPages = slugs.map((slug) => ({
    url: `${baseUrl}/posts/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...postPages,
  ];
}
