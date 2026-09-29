import { fail, getLikes, goHome, like, reload } from './actions'

// One action per thing the toolbar's actions segment can show.
export default async function Actions() {
  return (
    <>
      <h1>Server Actions</h1>
      <p>Likes: {await getLikes()}</p>
      <form style={{ display: 'flex', gap: 8 }}>
        <button formAction={like}>Like (revalidatePath)</button>
        <button formAction={reload}>Refresh (refresh())</button>
        <button formAction={fail}>Fail (throws)</button>
        <button formAction={goHome}>Go home (redirect)</button>
      </form>
    </>
  )
}
