import { ArrowRight2, CloseCircle, Danger, Hashtag, InfoCircle, Monitor, Mouse, PlayCircle, SearchNormal1, ShieldCross, type Icon } from 'iconsax-reactjs'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { DemoPlayground } from '@/components/demo-playground'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import type { ScenarioId } from '@/lib/demo-scenarios'

type Props = { params: Promise<{ locale: string }> }

const IDS: ScenarioId[] = ['home', 'blog', 'dashboard', 'account', 'checkout', 'notFound', 'settings', 'outdated']
const TRY: [string, Icon][] = [
  ['hover', Mouse],
  ['profiler', Hashtag],
  ['errors', Danger],
  ['seo', SearchNormal1],
  ['security', ShieldCross],
  ['minimize', CloseCircle],
  ['theme', Monitor],
]

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'demo' })
  return { title: t('title'), description: t('description') }
}

export default async function DemoPage({ params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'demo' })
  const copy = Object.fromEntries(
    IDS.map((id) => [id, { title: t(`items.${id}.title`), description: t(`items.${id}.description`), expect: t(`items.${id}.expect`) }]),
  ) as Record<ScenarioId, { title: string; description: string; expect: string }>

  return (
    <article className="min-w-0">
      <header className="mb-8 border-b border-border pb-8">
        <div className="mb-4 grid size-11 place-items-center rounded-xl border border-border bg-card shadow-sm">
          <PlayCircle variant="Broken" className="size-6 text-brand-text" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t('description')}</p>
      </header>

      <div className="mb-8 flex gap-3 rounded-xl border border-border bg-muted/60 p-4 text-sm leading-relaxed">
        <InfoCircle variant="Broken" className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p>{t('simulated')}</p>
      </div>

      <h2 className="mb-4 text-xl font-bold tracking-tight">{t('scenarios')}</h2>
      <DemoPlayground copy={copy} pageLabel={t('page')} />

      <h2 className="mt-12 mb-4 text-xl font-bold tracking-tight">{t('tryTitle')}</h2>
      <ul className="space-y-3">
        {TRY.map(([key, Icon]) => (
          <li key={key} className="flex gap-3 text-sm leading-relaxed">
            <Icon variant="Broken" className="mt-0.5 size-5 shrink-0 text-brand-text" aria-hidden="true" />
            {t(`try.${key}`)}
          </li>
        ))}
      </ul>

      <Link
        href="/getting-started"
        className="bg-brand mt-10 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-[#0b0f0c] shadow-[0_0_18px_rgba(126,250,190,0.35)] transition hover:brightness-105"
      >
        {t('cta')}
        <ArrowRight2 variant="Broken" className="size-4" aria-hidden="true" />
      </Link>
    </article>
  )
}
