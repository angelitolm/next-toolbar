'use client'
import { NextToolbarDemo } from '@angelitolm/next-toolbar'
import { Card, Chart21, DocumentText, Home2, SearchStatus, Setting2, ShieldCross, User, type Icon } from 'iconsax-reactjs'
import { useState } from 'react'
import { SCENARIOS, type ScenarioId } from '@/lib/demo-scenarios'

const ICONS: Record<ScenarioId, Icon> = {
  home: Home2,
  blog: DocumentText,
  dashboard: Chart21,
  account: User,
  checkout: Card,
  notFound: SearchStatus,
  settings: Setting2,
  outdated: ShieldCross,
}

type Copy = Record<ScenarioId, { title: string; description: string; expect: string }>

export function DemoPlayground({ copy, pageLabel }: { copy: Copy; pageLabel: string }) {
  const [active, setActive] = useState<ScenarioId>('dashboard')
  const scenario = SCENARIOS.find((s) => s.id === active)!

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {SCENARIOS.map(({ id, props }) => {
          const Icon = ICONS[id]
          const selected = id === active
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              aria-pressed={selected}
              className={`group relative flex gap-3 rounded-xl border p-4 text-left transition ${
                selected ? 'border-teal-500/50 bg-brand-soft' : 'border-border hover:border-teal-500/30 hover:bg-muted/60'
              }`}
            >
              {selected && <span className="bg-brand absolute inset-y-3 left-0 w-0.5 rounded-full" aria-hidden="true" />}
              <span className={`grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card ${selected ? 'text-brand-text' : 'text-muted-foreground'}`}>
                <Icon variant="Broken" className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{copy[id].title}</span>
                <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                  {pageLabel} {props.pathname}
                </span>
                <span className="mt-2 block text-sm text-muted-foreground">{copy[id].description}</span>
                <span className="mt-2 block text-xs font-medium text-brand-text">→ {copy[id].expect}</span>
              </span>
            </button>
          )
        })}
      </div>
      <NextToolbarDemo key={active} {...scenario.props} />
    </>
  )
}
