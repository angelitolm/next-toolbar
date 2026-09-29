'use server'

import { refresh, revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

let likes = 0

export async function like() {
  likes++
  revalidatePath('/actions')
}

export async function reload() {
  refresh()
}

export async function fail(): Promise<void> {
  throw new Error('subscribe failed on purpose')
}

export async function goHome() {
  redirect('/')
}

export async function getLikes() {
  return likes
}
