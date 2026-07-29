import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog";
import { getPosts, getArticles } from "@/lib/blog";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const staticPrimaryRoutes = [
  "initial-certification",
  "certification-renewal",
  "certification-payment",
  "ceu",
  "ic-rc",
  "reciprocity",
  "testing",
  "contact",
  "faq",
];

const staticSecondaryRoutes = [
  "remote-or-inperson",
  "blog",
  "store",
  "certification-sync",
  "directory",
  "verify",
  "board-application",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const products = getProducts();
  const posts = getPosts();

  const homepageEntry: MetadataRoute.Sitemap[number] = {
    url: `${base}/`,
    priority: 1,
    changeFrequency: "weekly",
  };

  const primaryEntries: MetadataRoute.Sitemap = staticPrimaryRoutes.map((route) => ({
    url: `${base}/${route}`,
    priority: 0.8,
    changeFrequency: "monthly" as const,
  }));

  const secondaryEntries: MetadataRoute.Sitemap = staticSecondaryRoutes.map((route) => ({
    url: `${base}/${route}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${base}/store/${product.slug}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
  }));

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    priority: 0.6,
    changeFrequency: "yearly" as const,
  }));

  const articleEntries: MetadataRoute.Sitemap = getArticles().map((article) => ({
    url: `${base}/blog/${article.slug}`,
    lastModified: new Date(article.date),
    priority: 0.7,
    changeFrequency: "monthly" as const,
  }));

  return [
    homepageEntry,
    ...primaryEntries,
    ...secondaryEntries,
    ...productEntries,
    ...articleEntries,
    ...postEntries,
  ];
}
