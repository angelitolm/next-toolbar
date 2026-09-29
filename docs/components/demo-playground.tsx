'use client'
import { NextToolbarDemo, type ActionCall } from '@angelitolm/next-toolbar'
import { Card, Chart21, DocumentText, FlashCircle, Home2, SearchStatus, Setting2, ShieldCross, User, type Icon } from 'iconsax-reactjs'
import { useRef, useState } from 'react'
import { ACCOUNT_BUTTONS, SCENARIOS, type ScenarioId, type SimulatedAction } from '@/lib/demo-scenarios'

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
export type ActionsCopy = { title: string; hint: string } & Record<SimulatedAction['key'], string>

export function DemoPlayground({ copy, pageLabel, actionsCopy }: { copy: Copy; pageLabel: string; actionsCopy: ActionsCopy }) {
  const [active, setActive] = useState<ScenarioId>('dashboard')
  const scenario = SCENARIOS.find((s) => s.id === active)!
  // Calls made with the buttons below, newest first; they go on top of the scenario's own.
  const [calls, setCalls] = useState<ActionCall[]>([])
  const seq = useRef(0)

  const pick = (id: ScenarioId) => {
    setActive(id)
    setCalls([])
  }

  const call = ({ actionId, status, revalidation, redirect, ms: [min, max] }: SimulatedAction) => {
    const id = `sim${++seq.current}`
    const durationMs = Math.round(min + Math.random() * (max - min))
    setCalls((c) => [{ id, actionId, page: scenario.props.pathname, startTime: Date.now() }, ...c])
    setTimeout(() => setCalls((c) => c.map((x) => (x.id === id ? { ...x, durationMs, status, revalidation, redirect } : x))), durationMs)
  }

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
              onClick={() => pick(id)}
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
      {scenario.props.actions && (
        <div className="mt-4 rounded-xl border border-teal-500/30 bg-brand-soft p-4">
          <div className="flex items-center gap-2 font-semibold">
            <FlashCircle variant="Broken" className="size-5 text-brand-text" aria-hidden="true" />
            {actionsCopy.title}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{actionsCopy.hint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ACCOUNT_BUTTONS.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => call(action)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition hover:border-teal-500/50"
              >
                {actionsCopy[action.key]}
              </button>
            ))}
          </div>
        </div>
      )}
      <NextToolbarDemo key={active} {...scenario.props} actions={scenario.props.actions && [...calls, ...scenario.props.actions]} />
    </>
  )
}
