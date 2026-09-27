import type { ComponentType } from 'react'
import {
  ArrangeHorizontal,
  Brush2,
  Code,
  Element3,
  Flash,
  Hierarchy,
  Home2,
  Layer,
  MessageQuestion,
  Setting2,
  Activity,
  TickCircle,
  type Icon,
} from 'iconsax-reactjs'
import type { Locale } from '@/i18n/routing'

// Single source of truth for the wiki: order drives the sidebar and prev/next links.
// Titles and descriptions live in messages/<locale>.json under `pages.<slug>`.
export const SECTIONS = [
  { key: 'start', pages: ['index', 'getting-started', 'configuration'] },
  { key: 'features', pages: ['toolbar', 'profiler', 'render-mode', 'fetch-cache'] },
  { key: 'reference', pages: ['compatibility', 'architecture', 'troubleshooting'] },
  { key: 'project', pages: ['design', 'contributing'] },
] as const

export type Slug = (typeof SECTIONS)[number]['pages'][number]

export const SLUGS: Slug[] = SECTIONS.flatMap((s) => [...s.pages])

export const isSlug = (v: string): v is Slug => (SLUGS as string[]).includes(v)

export const ICONS: Record<Slug, Icon> = {
  index: Home2,
  'getting-started': Flash,
  configuration: Setting2,
  toolbar: Element3,
  profiler: Activity,
  'render-mode': Layer,
  'fetch-cache': ArrangeHorizontal,
  compatibility: TickCircle,
  architecture: Hierarchy,
  troubleshooting: MessageQuestion,
  design: Brush2,
  contributing: Code,
}

// The home page lives at /<locale>, every other page at /<locale>/<slug>.
export const hrefOf = (slug: Slug) => (slug === 'index' ? '/' : `/${slug}`)

export function neighbours(slug: Slug) {
  const i = SLUGS.indexOf(slug)
  return { prev: SLUGS[i - 1] as Slug | undefined, next: SLUGS[i + 1] as Slug | undefined }
}

type Loader = () => Promise<{ default: ComponentType }>

// Static import map: every path is visible to the bundler (no template-literal imports).
const CONTENT: Record<Locale, Record<Slug, Loader>> = {
  en: {
    index: () => import('@/content/en/index.mdx'),
    'getting-started': () => import('@/content/en/getting-started.mdx'),
    configuration: () => import('@/content/en/configuration.mdx'),
    toolbar: () => import('@/content/en/toolbar.mdx'),
    profiler: () => import('@/content/en/profiler.mdx'),
    'render-mode': () => import('@/content/en/render-mode.mdx'),
    'fetch-cache': () => import('@/content/en/fetch-cache.mdx'),
    compatibility: () => import('@/content/en/compatibility.mdx'),
    architecture: () => import('@/content/en/architecture.mdx'),
    troubleshooting: () => import('@/content/en/troubleshooting.mdx'),
    design: () => import('@/content/en/design.mdx'),
    contributing: () => import('@/content/en/contributing.mdx'),
  },
  es: {
    index: () => import('@/content/es/index.mdx'),
    'getting-started': () => import('@/content/es/getting-started.mdx'),
    configuration: () => import('@/content/es/configuration.mdx'),
    toolbar: () => import('@/content/es/toolbar.mdx'),
    profiler: () => import('@/content/es/profiler.mdx'),
    'render-mode': () => import('@/content/es/render-mode.mdx'),
    'fetch-cache': () => import('@/content/es/fetch-cache.mdx'),
    compatibility: () => import('@/content/es/compatibility.mdx'),
    architecture: () => import('@/content/es/architecture.mdx'),
    troubleshooting: () => import('@/content/es/troubleshooting.mdx'),
    design: () => import('@/content/es/design.mdx'),
    contributing: () => import('@/content/es/contributing.mdx'),
  },
}

export async function loadPage(locale: Locale, slug: Slug): Promise<ComponentType> {
  return (await CONTENT[locale][slug]()).default
}

export const REPO = 'https://github.com/angelitolm/next-toolbar'
export const editUrl = (locale: Locale, slug: Slug) => `${REPO}/edit/main/docs/content/${locale}/${slug}.mdx`
