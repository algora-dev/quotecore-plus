# How to publish a blog post

## Step 1 - Create the MDX file

Create a new file at:
`app/blog/[slug]/content/<your-slug>.mdx`

Write the post in standard Markdown. Example:

```mdx
QuoteCore+ helps roofers quote faster by...

## How it works

1. Measure the roof
2. Enter into QuoteCore+
3. Send the quote
```

## Step 2 - Register the post

Open `app/blog/[slug]/page.tsx` and add an entry to the `posts` object:

```ts
"your-slug": {
  title: "Your Post Title",
  description: "One-sentence meta description (under 160 chars).",
  date: "2026-05-10",
  content: () => import("./content/your-slug.mdx"),
},
```

Also add the same entry to the posts array in `app/blog/page.tsx` so it appears on the index.

## Step 3 - Update the sitemap

Add the post URL to `app/sitemap.ts`:

```ts
{
  url: `${base}/blog/your-slug`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.7,
},
```

## Step 4 - Deploy

Tell Barry to deploy to Vercel. Done.
