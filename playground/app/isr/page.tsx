export const revalidate = 60

export default async function Isr() {
  const res = await fetch('https://worldtimeapi.org/api/ip', { next: { revalidate: 60 } }).catch(() => null)
  return <h1>ISR at {new Date().toISOString()} ({res?.status ?? 'offline'})</h1>
}
