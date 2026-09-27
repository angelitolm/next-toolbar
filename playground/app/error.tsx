'use client'

export default function Error({ error }: { error: Error }) {
  return <h1>Error boundary: {error.message}</h1>
}
