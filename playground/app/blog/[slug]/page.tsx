export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <h1>Post {slug}</h1>
}
