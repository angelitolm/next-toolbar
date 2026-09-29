import type { Metadata } from 'next'

type Props = { params: Promise<{ slug: string }> }

// Deliberately imperfect, to exercise the toolbar's SEO segment: long title, no description,
// og:image that 404s.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `Post ${slug}: a deliberately long title to trigger the length warning`,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: { images: [`/og/${slug}.png`] },
  }
}

export default async function Post({ params }: Props) {
  const { slug } = await params
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: `Post ${slug}` }) }} />
      <h1>Post {slug}</h1>
    </>
  )
}
