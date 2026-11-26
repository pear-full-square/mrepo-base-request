// A request, as the runtime package's types have it
// (haiccing/base-package-runtime, types/request.avsc): self-contained, what
// was asked and by whom, as understood, its processing, what is returned.
// Each function gives a new request; none changes one, none stores one.
// What the runtime is brought to, a function a step: today it writes
// lib/record.js's forms, and calls none of these.
//   asked(command, { from, to, reply, origin })  a request as it arrives:
//                                                the line as typed
//   filled(form, { from, to, reply, origin })    one whose form came filled in
//   understood(request, protocols, at)           its form, from its line
//   noted(request, level, event, line, time)     an entry added to its log
//   measured(request, metrics)                   its metrics
//   returned(request, status, message, attachments)
//                                                completed: done or failed
//   isReturned(request)                          completed already
import { interpret, OWN } from './command.js'
import { words } from './lines.js'

export const STATUS = ['done', 'failed']
const processing = () => ({ log: [], metrics: null, changed: [], waiting: null, path: [], continuation: null })
const said = v => (v === undefined || v === null ? null : v)

// (who asked, who it is for, where its answer goes, its offset where it
// came from: the request's own, whatever carries it)
const own = ({ from = null, to = null, reply = null, origin = null } = {}) => ({ from: said(from), to: said(to), reply: said(reply), origin: said(origin) })

export function asked (command, addressed = {}) {
  if (typeof command !== 'string' || !command.trim()) throw new Error('not a command: a line, <protocol>/<action> <URI> <arguments>')
  return { command, ...own(addressed), form: null, processing: processing(), returned: null }
}

// A form as the type has it: its arguments texts, its flags a text each (a
// flag that stands alone: 'true').
const formed = ({ protocol, action, uri, args = [], flags = {} }) => ({
  protocol,
  action,
  uri,
  args: args.map(String),
  flags: Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, String(v)]))
})

export function filled (form, addressed = {}) {
  if (!form || typeof form.protocol !== 'string' || typeof form.action !== 'string' || !Array.isArray(form.uri)) throw new Error('not a form: its protocol, its action, its URI\'s segments')
  return { command: null, ...own(addressed), form: formed(form), processing: processing(), returned: null }
}

// Its line read by the one parser (the shell's words, lib/lines.js), then
// interpreted where the writer stands (lib/command.js): throws, saying why,
// when it is no command.
export function understood (request, protocols = {}, at = OWN) {
  if (request.form) return request
  return { ...request, form: formed(interpret(words(request.command), protocols, at)) }
}

export function noted (request, level, event, line, time = new Date().toISOString()) {
  return { ...request, processing: { ...request.processing, log: [...request.processing.log, { time, level, event, line }] } }
}

export function measured (request, { ms, reads = 0, selects = 0, puts = 0, removes = 0, commits = 0 }) {
  return { ...request, processing: { ...request.processing, metrics: { ms, reads, selects, puts, removes, commits } } }
}

export const isReturned = request => request.returned !== null

// Completed: how it ended and what is said of it, natural language (the
// outcome first, a fact a line); its data where data is the product, each
// attachment its name, its type's URI and where its value is.
export function returned (request, status, message, attachments = []) {
  if (!STATUS.includes(status)) throw new Error(`not a status: ${status} (${STATUS.join(', ')})`)
  if (typeof message !== 'string' || !message.trim()) throw new Error('nothing said: what is returned says what happened')
  if (isReturned(request)) throw new Error('returned already')
  return { ...request, returned: { status, message, attachments: attachments.map(({ name, type, at = null }) => ({ name, type, at })) } }
}
