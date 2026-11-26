// A record: the transport envelope, as the runtime package's type has it
// (haiccing/base-package-runtime, types/record.avsc): { topic, key, offset,
// timestamp, headers }, and what it carries, its value: one level, a
// request in the request streams (lib/request.js: self-contained, who
// asked and where its answer goes its own). Each hand-over is a new record
// (its topic the new place) around the same request.
//
// The offset: the milliseconds since the epoch when the request arrived at
// the mrepo (its inbox; its own requests, the same clock), given by the
// drop method (lib/boxes.js), never two the same. It is the request's one
// identity there: on every record around it, and the name of its document
// in every layer (13 digits): a request traced everywhere by it, and a
// layer's natural order. An offset is one mrepo's: a request that comes in
// from another (a child's answer) gets its own here, on its record, the
// other's kept as the record's key.
// (guid: an identity that is no request's: a link's)
import crypto from 'bare-crypto'

export const guid = () => {
  const b = crypto.randomBytes(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
export const record = (topic, value, offset = null, key = null) => ({ topic, key, offset, timestamp: Date.now(), headers: {}, value })
// (wrap, stamp's core, complete, isComplete: the first form's, an envelope
// around a core; here until the execute and runtime modules are brought to
// the request, then removed)
// An envelope around a record: its offset the record's (another: a record
// from elsewhere, given its own here).
export const wrap = (topic, inner, offset = inner?.offset ?? null) => record(topic, inner, offset)
// A record given its offset: stamped on it, and on its core when it is an
// envelope around one that has none yet.
export const stamp = (rec, offset) => ({ ...rec, offset, ...(rec.value && typeof rec.value === 'object' && 'topic' in rec.value && 'value' in rec.value && rec.value.offset == null ? { value: { ...rec.value, offset } } : {}) })
// An mrepo's clock where it has no inbox folder to give its offsets (a
// store on git alone, a test): in one process, now or the last plus one.
let last = 0
export const tick = (now = Date.now()) => (last = Math.max(now, last + 1))
// Completed: its output (or the error that stopped it), and its log when
// there is one (the entries kept: a request is its own record).
// (a continuation: with an output, what the one who asked goes on with:
// { at, script }; continuationOf says what one is)
export const complete = (core, result, log = []) => ({ ...core, value: { ...core.value, ...(result.ok ? { output: result.value } : { error: result.error }), ...(result.ok && result.continuation ? { continuation: result.continuation } : {}), ...(log.length ? { log } : {}) } })
// A continuation: a script to continue with, answered beside an output:
// { at, script }: the position it is run for, from the root as the one
// who answers sees it (`.` itself), and the script, its lines, each a
// simple command; at most CEILING bytes. Sent on by who asked, the
// terminal, as haicc/script at the position; not by an mrepo.
export const CEILING = 65536
export function continuationOf (script, at = '.') {
  if (typeof script !== 'string' || !script.trim()) throw new Error('not a continuation: its script, shell text')
  if (Buffer.byteLength(script) > CEILING) throw new Error(`not a continuation: ${Buffer.byteLength(script)} bytes (at most ${CEILING})`)
  if (typeof at !== 'string' || !at) throw new Error('not a continuation: the position it is run for')
  return { at, script }
}
// Log levels. An error and a warning are always kept (ALWAYS). Of the
// other three (DETAIL) a request says how much it wants: info, the least
// and what it gets unasked, verbose (its steps), debug (its internals).
// There is no level that keeps nothing. An entry is the request type's:
// { time, level, event, line }: when (milliseconds), its level, its kind
// (a stable name), and what happened, said: a line.
//   logger(level) -> { log(level, event, line), entries, level(to) }
//     level(to)   the detail kept from here on set to `to`; -> the one in
//                 use (a flag set later in a chain)
export const ALWAYS = ['error', 'warn']
export const DETAIL = ['info', 'verbose', 'debug']
export const LEVELS = [...ALWAYS, ...DETAIL]
export function logger (detail = 'info', now = () => Date.now()) {
  let max = Math.max(0, DETAIL.indexOf(detail))
  const entries = []
  const log = (level, event, line) => {
    if (!LEVELS.includes(level)) throw new Error(`not a log level: ${level} (${LEVELS.join(', ')})`)
    if (typeof line !== 'string' || !line.trim()) throw new Error(`not a log entry: ${event} (what happened, said: a line)`)
    if (ALWAYS.includes(level) || DETAIL.indexOf(level) <= max) entries.push({ time: now(), level, event, line })
  }
  const level = to => { if (DETAIL.includes(to)) max = DETAIL.indexOf(to); return DETAIL[max] }
  return { log, entries, level }
}
export const isComplete = core => Boolean(core?.value) && ('output' in core.value || 'error' in core.value)
