// Theme tokens. Dark is the default; light applies with data-theme="light" on the host,
// or with the OS preference when no explicit theme is set (data-theme absent).
const light = /* css */ `
  --nt-glow: 0 0 14px rgba(94, 245, 180, .5);
  --nt-surface: linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%);
  --nt-surface-flat: #fbfbfc;
  --nt-raised: rgba(15, 15, 20, .045);
  --nt-hover: rgba(15, 15, 20, .07);
  --nt-border: rgba(15, 15, 20, .1);
  --nt-text: #18181b;
  --nt-dim: #6b6b76;
  --nt-err: #d93636;
  --nt-warn: #b86e00;
  --nt-warn-bg: rgba(217, 119, 6, .12);
  --nt-err-bg: rgba(220, 38, 38, .1);
  --nt-err-border: rgba(220, 38, 38, .25);
  --nt-err-text: #c02626;
  --nt-static-bg: rgba(20, 184, 166, .12);
  --nt-static-fg: #0f766e;
  --nt-dynamic-bg: rgba(101, 163, 13, .14);
  --nt-dynamic-fg: #4d7c0f;
  --nt-accent: #14b8a6;
  --nt-active-bg: rgba(20, 184, 166, .09);
  --nt-none-dot: #b4b4bc;
  --nt-scrollbar: rgba(15, 15, 20, .2);
  --nt-shadow: 0 20px 40px -16px rgba(15, 23, 42, .25), 0 6px 14px -6px rgba(15, 23, 42, .12), inset 0 1px 0 #ffffff;
`

export const css = /* css */ `
:host {
  all: initial;
  --nt-from: #c6ff5c;
  --nt-to: #5ef5e0;
  --nt-primary: linear-gradient(90deg, var(--nt-from), var(--nt-to));
  --nt-on-primary: #0b0f0c;
  --nt-glow: 0 0 18px rgba(126, 250, 190, .45);
  --nt-surface: linear-gradient(180deg, #38383b 0%, #1f1f21 100%);
  --nt-surface-flat: #1c1c1e;
  --nt-raised: rgba(255, 255, 255, .06);
  --nt-hover: rgba(255, 255, 255, .09);
  --nt-border: rgba(255, 255, 255, .09);
  --nt-text: #f4f4f5;
  --nt-dim: #9d9da3;
  --nt-err: #ff6b6b;
  --nt-warn: #ffb547;
  --nt-warn-bg: rgba(255, 181, 71, .16);
  --nt-err-bg: rgba(255, 107, 107, .16);
  --nt-err-border: rgba(255, 107, 107, .25);
  --nt-err-text: #ff9b9b;
  --nt-static-bg: rgba(94, 245, 224, .12);
  --nt-static-fg: #7ff7e6;
  --nt-dynamic-bg: rgba(198, 255, 92, .13);
  --nt-dynamic-fg: #d3ff84;
  --nt-accent: var(--nt-to);
  --nt-active-bg: rgba(94, 245, 224, .08);
  --nt-ring: #1f1f21;
  --nt-logo: #f4f4f5;
  /* The logo always sits on a dark tile: the lime end of the gradient vanishes on white. */
  --nt-mark-bg: linear-gradient(180deg, #38383b 0%, #1f1f21 100%);
  --nt-none-dot: #5a5a60;
  --nt-scrollbar: rgba(255, 255, 255, .18);
  --nt-shadow: 0 24px 48px -12px rgba(0, 0, 0, .55), 0 8px 16px -8px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .08);
  --nt-radius: 12px;
  --nt-font: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --nt-mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace;
}
:host([data-theme="light"]) {${light}}
@media (prefers-color-scheme: light) {
  :host(:not([data-theme="dark"])) {${light}}
}

* { box-sizing: border-box; }
button { all: unset; box-sizing: border-box; cursor: pointer; }
button:focus-visible, .seg:focus-visible { outline: 2px solid var(--nt-accent); outline-offset: 2px; }
code { font: 12px var(--nt-mono); }
.dim { color: var(--nt-dim); }
.ico { flex-shrink: 0; color: var(--nt-dim); }
.ico-err { color: var(--nt-err); }
.ico-warn { color: var(--nt-warn); }
.ico-ok { color: var(--nt-static-fg); }
.count.warn { background: var(--nt-warn); color: #1a1205; }
.seg:hover .ico { color: var(--nt-text); }
.chevron { flex-shrink: 0; align-self: center; color: var(--nt-err); transition: transform .15s; }
details[open] > summary > .chevron { transform: rotate(90deg); }
.go { display: inline-flex; align-items: center; gap: 4px; }
.spacer { flex: 1; }

/* Slim, arrow-less scrollbars for every scrollable area (panels, profiler, stacks).
   Chromium/Safari use the ::-webkit-scrollbar rules; setting scrollbar-width there would make
   Chrome ignore them and draw OS arrows, so the standard properties are only for the others. */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
::-webkit-scrollbar-track { background: transparent; margin-block: 8px; }
::-webkit-scrollbar-corner { background: transparent; }
::-webkit-scrollbar-thumb { background-color: var(--nt-scrollbar); border: 3px solid transparent; border-radius: 999px; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background-color: var(--nt-dim); }
@supports not selector(::-webkit-scrollbar) {
  * { scrollbar-width: thin; scrollbar-color: var(--nt-scrollbar) transparent; }
}

/* Shared floating surface */
.bar, .launcher, .panel, .profiler {
  background: var(--nt-surface); border: 1px solid var(--nt-border); box-shadow: var(--nt-shadow);
  color: var(--nt-text); font: 13px/1.2 var(--nt-font); -webkit-font-smoothing: antialiased;
}
.launcher { background: var(--nt-mark-bg); border-color: rgba(255, 255, 255, .09); }

/* Launcher: the collapsed state, a circle that holds the logo */
.launcher {
  position: fixed; left: 16px; bottom: 16px; z-index: 2147483000;
  width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; color: var(--nt-logo);
  transition: transform .2s cubic-bezier(.2, .8, .2, 1), box-shadow .2s;
  animation: nt-pop .25s cubic-bezier(.2, .8, .2, 1);
}
.launcher:hover { transform: scale(1.06); box-shadow: var(--nt-shadow), var(--nt-glow); }
.launcher .dot { position: absolute; top: 3px; right: 3px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--nt-ring); }
.launcher .dot.ok { background: var(--nt-primary); box-shadow: var(--nt-glow); }
.launcher .dot.warn { background: var(--nt-warn); } .launcher .dot.err { background: var(--nt-err); } .launcher .dot.none { background: var(--nt-none-dot); }
.launcher .bubble {
  position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
  display: grid; place-items: center; background: var(--nt-err); color: #fff; font: 700 11px var(--nt-font); border: 2px solid var(--nt-ring);
}

/* Bar: full-width floating strip, grows out of the launcher position */
.bar {
  position: fixed; left: 16px; right: 16px; bottom: 8px; z-index: 2147483000;
  height: 45px; padding: 6px; border-radius: 14px; display: flex; align-items: center; gap: 2px;
  transform-origin: 26px 50%; animation: nt-expand .28s cubic-bezier(.2, .8, .2, 1);
}
.logo-btn, .mark { width: 40px; height: 40px; flex-shrink: 0; border-radius: 10px; display: grid; place-items: center; background: var(--nt-mark-bg); color: var(--nt-logo); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08); }
.logo-btn:hover { filter: brightness(1.15); }
.mark { width: 30px; height: 30px; border-radius: 8px; }
.nt-version { padding: 0 4px 0 6px; font: 500 11px var(--nt-mono); color: var(--nt-dim); white-space: nowrap; }
.brand .nt-version { padding: 0; }
.sep { width: 1px; height: 22px; margin: 0 4px; background: var(--nt-border); flex-shrink: 0; }
.seg {
  position: relative; height: 40px; display: flex; align-items: center; gap: 7px; padding: 0 12px;
  border-radius: 9px; white-space: nowrap; transition: background .15s;
}
.seg:hover, .seg:focus-within { background: var(--nt-hover); }
.seg.is-new { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nt-from) 45%, transparent); }
.new-badge { position: absolute; top: -9px; right: 4px; padding: 1px 6px; border-radius: 99px; background: var(--nt-primary); color: var(--nt-on-primary); font: 700 9px/1.4 var(--nt-font); letter-spacing: .02em; pointer-events: none; }
.icon-btn { width: 36px; height: 36px; border-radius: 9px; display: grid; place-items: center; color: var(--nt-dim); flex-shrink: 0; }
.icon-btn:hover { background: var(--nt-hover); color: var(--nt-text); }
.text-btn { height: 32px; padding: 0 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; color: var(--nt-dim); font-size: 12px; font-weight: 600; border: 1px solid var(--nt-border); }
.text-btn:hover { background: var(--nt-hover); color: var(--nt-text); }

/* Status chip: primary gradient when OK */
.status { height: 27px; min-width: 52px; justify-content: center; padding: 0 10px; border-radius: 8px; font-weight: 700; font-size: 12px; letter-spacing: .01em; }
.status.ok { background: var(--nt-primary); color: var(--nt-on-primary); box-shadow: var(--nt-glow); }
.status.ok:hover { background: var(--nt-primary); filter: brightness(1.06); }
.status.warn { background: var(--nt-warn-bg); color: var(--nt-warn); }
.status.err { background: var(--nt-err-bg); color: var(--nt-err); }
.status.none { background: var(--nt-raised); color: var(--nt-dim); }

.token { font: 12px var(--nt-mono); color: var(--nt-dim); gap: 5px; }
.token:hover { color: var(--nt-text); }
.route { font-weight: 600; }

.badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; letter-spacing: .02em; }
.badge.static { background: var(--nt-static-bg); color: var(--nt-static-fg); }
.badge.static-maybe { border: 1px dashed var(--nt-static-fg); color: var(--nt-static-fg); padding: 3px 7px; }
.badge.dynamic { background: var(--nt-dynamic-bg); color: var(--nt-dynamic-fg); }
.badge.pending, .badge.unknown { background: var(--nt-raised); color: var(--nt-dim); }

.count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 6px; display: inline-grid; place-items: center; background: var(--nt-raised); font-size: 11px; font-weight: 700; }
.count.err { background: var(--nt-err); color: #fff; }
.metric b { font-weight: 600; }

/* Hover panels float above the bar */
.panel {
  /* width: max-content, or the panel shrinks to its (narrow) segment and content overflows */
  display: none; position: absolute; bottom: calc(100% + 14px); left: 0; width: max-content; min-width: 300px; max-width: min(560px, calc(100vw - 32px));
  max-height: 60vh; overflow: auto; padding: 8px; border-radius: var(--nt-radius); white-space: normal; cursor: default;
  animation: nt-rise .18s ease-out;
}
/* Invisible bridge so the pointer can travel from segment to panel */
.seg::after { content: ""; position: absolute; left: 0; right: 0; bottom: 100%; height: 16px; display: none; }
.seg:hover::after { display: block; }
.seg:hover .panel, .seg:focus-within .panel { display: block; }
.right .panel { left: auto; right: 0; }
.row { display: flex; gap: 16px; justify-content: space-between; align-items: baseline; padding: 7px 10px; border-radius: 7px; line-height: 1.35; }
.row:hover { background: var(--nt-raised); }
.row > :first-child { color: var(--nt-dim); flex-shrink: 0; }
.row > :last-child { text-align: right; }
.row code { word-break: break-all; }
.fetch-row { padding: 8px 10px; border-radius: 7px; }
.fetch-row:hover { background: var(--nt-raised); }
.fetch-row > div { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.fetch-row code { display: block; word-break: break-all; line-height: 1.4; }
.error-item { display: block; width: 100%; padding: 8px 10px; border-radius: 7px; text-align: left; line-height: 1.4; }
button.error-item { display: flex; align-items: baseline; gap: 10px; }
.error-item:hover, .error-item[open] { background: var(--nt-err-bg); }
.error-item .kind { color: var(--nt-err); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; flex-shrink: 0; }
.error-item .msg { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.error-item code { overflow-wrap: anywhere; }
.error-item .go { margin-left: auto; color: var(--nt-dim); font-size: 12px; flex-shrink: 0; }
.error-item:hover .go { color: var(--nt-text); }
.error-item > summary { cursor: pointer; list-style: none; display: flex; align-items: baseline; gap: 10px; }
.error-item > summary::-webkit-details-marker { display: none; }
.error-item pre { margin: 8px 0 2px; padding: 8px 10px; max-height: 200px; overflow: auto; border-radius: 6px; background: var(--nt-raised); font: 11px/1.5 var(--nt-mono); white-space: pre-wrap; word-break: break-word; }
.security .panel { min-width: 360px; left: auto; right: 0; }
.links .panel { min-width: 360px; max-width: min(460px, calc(100vw - 32px)); left: auto; right: 0; }
.link-row { display: flex; gap: 10px; align-items: baseline; padding: 5px 10px; border-radius: 7px; }
.link-row:hover { background: var(--nt-raised); }
.link-row code { word-break: break-all; }
.text-btn:disabled { opacity: .6; cursor: default; }
.actions .panel { min-width: 440px; max-width: min(520px, calc(100vw - 32px)); left: auto; right: 0; }
.act-head { display: flex; align-items: flex-start; gap: 6px; }
.act-head .sec-head { flex: 1; }
.act-row { display: grid; grid-template-columns: minmax(0, 1.6fr) 56px 56px minmax(0, 1.2fr); gap: 8px; align-items: baseline; padding: 6px 10px; border-radius: 7px; line-height: 1.35; }
.act-row:hover:not(.act-cols) { background: var(--nt-raised); }
.act-cols { font-size: 11px; padding-bottom: 2px; }
.reval { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 4px 10px 6px; }
.reval > .dim { margin-right: 4px; }
.reval form { display: flex; gap: 6px; }
.reval input { height: 32px; width: 120px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--nt-border); background: var(--nt-raised); color: var(--nt-text); font: 12px var(--nt-mono); }
.reval input:focus { outline: 2px solid var(--nt-to); outline-offset: 1px; }
.hint-err { color: var(--nt-err); }
.act-id { display: flex; flex-direction: column; min-width: 0; }
.act-id > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seo .panel { min-width: 380px; max-width: min(460px, calc(100vw - 32px)); left: auto; right: 0; }
.sep-h { height: 1px; background: var(--nt-border); margin: 6px 10px; }
.issue { display: flex; gap: 8px; align-items: baseline; padding: 5px 10px; line-height: 1.4; }
.issue-dot { flex-shrink: 0; width: 7px; height: 7px; border-radius: 50%; transform: translateY(-1px); }
.issue-dot.err { background: var(--nt-err); } .issue-dot.warn { background: var(--nt-warn); } .issue-dot.ok { background: var(--nt-static-fg); }
.sec-head { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px 10px; }
.upgrade { display: flex; flex-direction: column; gap: 6px; margin: 0 4px 8px; padding: 10px 12px; border-radius: 8px; line-height: 1.4; }
.upgrade.err { background: var(--nt-err-bg); border: 1px solid var(--nt-err-border); }
.upgrade.warn { background: var(--nt-warn-bg); }
.upgrade code { user-select: all; padding: 4px 8px; border-radius: 6px; background: var(--nt-raised); align-self: flex-start; }
.adv-row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-radius: 7px; color: inherit; text-decoration: none; line-height: 1.35; }
.adv-row:hover { background: var(--nt-raised); }
.adv-row .ico { margin-top: 2px; }
.adv-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.adv-title { overflow-wrap: anywhere; }
.adv-main .dim { font-size: 11px; }
.sev { flex-shrink: 0; min-width: 62px; text-align: center; padding: 2px 6px; border-radius: 5px; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.sev.critical { background: var(--nt-err); color: #fff; }
.sev.high { background: var(--nt-err-bg); color: var(--nt-err); }
.sev.medium { background: var(--nt-warn-bg); color: var(--nt-warn); }
.sev.low { background: var(--nt-raised); color: var(--nt-dim); }
.sec-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px 4px; margin-top: 4px; border-top: 1px solid var(--nt-border); font-size: 11px; }
.hint { padding: 7px 10px; color: var(--nt-dim); font-size: 12px; line-height: 1.5; }
.hint code { color: var(--nt-text); }

/* Cache outcome pills */
.cache { display: inline-block; padding: 2px 6px; border-radius: 5px; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; background: var(--nt-raised); color: var(--nt-dim); }
.cache.hit { background: var(--nt-primary); color: var(--nt-on-primary); }
.cache.hmr { background: var(--nt-static-bg); color: var(--nt-static-fg); }
.cache.miss { background: var(--nt-warn-bg); color: var(--nt-warn); }
.cache-summary { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; text-transform: none; letter-spacing: 0; font-weight: 400; }

/* Profiler: large floating card above the bar */
.profiler {
  position: fixed; left: 16px; right: 16px; top: 6vh; bottom: 84px; z-index: 2147483000;
  display: flex; flex-direction: column; overflow: hidden; border-radius: 16px; background: var(--nt-surface-flat);
  font-size: 13px; line-height: 1.4; animation: nt-rise .22s cubic-bezier(.2, .8, .2, 1);
}
.profiler header { display: flex; align-items: center; gap: 10px; height: 56px; padding: 0 10px 0 18px; border-bottom: 1px solid var(--nt-border); background: var(--nt-surface); }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 14px; }
.profiler-body { flex: 1; display: flex; min-height: 0; }
.req-list { list-style: none; margin: 0; padding: 8px; width: 320px; flex-shrink: 0; overflow: hidden auto; border-right: 1px solid var(--nt-border); }
.req-list button { display: flex; gap: 8px; align-items: center; width: 100%; padding: 9px 10px; border-radius: 8px; font-size: 13px; color: var(--nt-text); }
.req-list button:hover { background: var(--nt-raised); }
.req-list button.active { background: var(--nt-active-bg); box-shadow: inset 2px 0 0 var(--nt-accent); }
.req-route { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { min-width: 38px; text-align: center; padding: 3px 6px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.pill.ok { background: var(--nt-primary); color: var(--nt-on-primary); }
.pill.warn { background: var(--nt-warn-bg); color: var(--nt-warn); }
.pill.err { background: var(--nt-err-bg); color: var(--nt-err); }
.pill.none { background: var(--nt-raised); color: var(--nt-dim); }
.tag { font-size: 10px; padding: 2px 6px; border: 1px solid var(--nt-border); border-radius: 5px; color: var(--nt-dim); }
.req-detail { flex: 1; overflow: auto; padding: 8px 24px 24px; }
.req-detail section { margin-top: 20px; }
.req-detail h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--nt-dim); }
.req-detail .hint { padding: 0; }
dl { display: grid; grid-template-columns: 110px 1fr; gap: 8px 12px; margin: 0; }
dt { color: var(--nt-dim); } dd { margin: 0; word-break: break-all; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--nt-border); vertical-align: top; }
th { color: var(--nt-dim); font-weight: 600; }
td code { word-break: break-all; }
.error-row { margin-bottom: 6px; border-radius: 8px; background: var(--nt-err-bg); border: 1px solid var(--nt-err-border); }
.error-row > summary { padding: 10px 12px; cursor: pointer; list-style: none; display: flex; align-items: baseline; gap: 8px; }
.error-row > summary::-webkit-details-marker { display: none; }
.error-row dl { padding: 4px 12px 8px 34px; grid-template-columns: 120px 1fr; }
.error-row .hint { padding: 0 12px 12px 34px; }
.error-row pre.stack { margin: 0 12px 12px; padding: 8px 10px; max-height: 220px; overflow: auto; border-radius: 6px; background: var(--nt-raised); font: 11px/1.5 var(--nt-mono); white-space: pre-wrap; word-break: break-word; }
.note { margin-top: 24px; padding: 10px 12px; border: 1px dashed var(--nt-border); border-radius: 8px; color: var(--nt-dim); font-size: 12px; line-height: 1.5; }
.note code { color: var(--nt-text); }
.req-list .count { min-width: 18px; height: 18px; font-size: 10px; }
.timeline { font-size: 12px; }
.span-row { display: grid; grid-template-columns: minmax(140px, 32%) 1fr 64px; gap: 10px; align-items: center; height: 24px; padding: 0 6px; border-radius: 6px; }
.span-row:hover { background: var(--nt-raised); }
.span-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.span-track { position: relative; height: 8px; background: var(--nt-raised); border-radius: 4px; }
.span-bar { position: absolute; top: 0; bottom: 0; border-radius: 4px; background: var(--nt-primary); box-shadow: 0 0 10px rgba(126, 250, 190, .35); }
.span-bar.err { background: var(--nt-err); box-shadow: 0 0 10px rgba(255, 107, 107, .4); }
.err-text { color: var(--nt-err-text); }
.span-ms { text-align: right; }

@keyframes nt-expand { from { opacity: 0; transform: scaleX(.3); } to { opacity: 1; transform: none; } }
@keyframes nt-pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
@keyframes nt-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .bar, .launcher, .panel, .profiler { animation: none; } .launcher { transition: none; } }

/* Set by useBarDensity when the bar doesn't fit on one line. */
.bar.compact .hide-md { display: none; }
.bar.compact .seg { padding: 0 9px; }
.bar.tight .hide-sm { display: none; }
.bar.tight .seg { padding: 0 7px; }
.bar.scroll { overflow-x: auto; scrollbar-width: none; }
.bar.scroll::-webkit-scrollbar { display: none; }
.bar.scroll .new-badge { display: none; } /* would be clipped */

@media (max-width: 640px) {
  .bar { left: 8px; right: 8px; bottom: 8px; overflow-x: auto; scrollbar-width: none; }
  .new-badge { display: none; } /* the scrolling bar would clip it; the outline stays */
  .bar::-webkit-scrollbar { display: none; }
  .launcher { left: 8px; bottom: 8px; }
  .hide-sm { display: none; }
  .profiler { left: 8px; right: 8px; top: 8px; bottom: 72px; }
  .profiler-body { flex-direction: column; }
  .req-list { width: auto; max-height: 35%; border-right: 0; border-bottom: 1px solid var(--nt-border); }
  .req-detail { padding: 4px 14px 16px; }
}
`
