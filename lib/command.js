// A command: a request as it is typed, its parts in order,
//   <protocol>/<action> <URI> <argument>...
// given as an array of parts or as a string (split at its spaces).
//
// A URI in a request is relative: no leading slash, relative to where its
// writer stands. `.` is the position itself; none given means `.`; `./x`
// is `x`. Outside it is one segment, as it is written.
// Inside, in the form the mrepo works with, a URI is an array of segments
// (mycelium-uri): the prefix where its writer stands, then the URI as it
// was written:
//   OUTSIDE   a request from outside stands at the mrepo's main: the prefix
//             main, two segments: ['main', 'host'], ['main', '.']; the
//             outside is restricted to main
//   OWN       the mrepo itself (a hook, a request of its own) stands at its
//             root, the folder above the layers: no prefix, one segment,
//             the layer first in it: ['runtime/hooks'], ['.']
//
// Flags (lib/flags.js) are written with a command, after the word --flags:
// a list in front of it, closed by --, or after its words, to the end or
// to --. In the form they are a map, `flags`, there only when one was
// written or came with the request. The words after the URI of a command
// that passes them on (its action's config: `command: true`, haicc's goto)
// are left as written: a list among them is the next command's.
import { relative, ROOT } from 'mycelium-uri'
import { split } from './flags.js'

export { ROOT }
export const MAIN = 'main'
export const OUTSIDE = [MAIN]
export const OWN = []

//   interpret(command, protocols, at) -> { protocol, action, uri, args, flags? }
//     the first part    <protocol>/<action>; the protocol alone: its default
//                       action (its config's `default`, in protocols)
//     the second        the URI, as written where the writer stands (at,
//                       a prefix: OWN by default); none: `.`; in the form
//                       the prefix's segments, then it
//     the rest          the arguments, a list, unnamed
// Throws when it is no command, or the action cannot be told.
export function interpret (command, protocols = {}, at = OWN) {
  const given = typeof command === 'string' ? command.trim().split(/\s+/).filter(Boolean) : command
  if (!Array.isArray(given) || !given.length || given.some(p => typeof p !== 'string' || !p)) throw new Error('not a command: its parts, <protocol>/<action> <URI> <arguments>')
  // a flag list in front is the command's own
  const led = split(given, { after: false })
  const first = led.parts[0]
  const names = first.split('/')
  if (names.length > 2 || names.some(n => !n)) throw new Error(`not a command: ${first} (<protocol>/<action>)`)
  const [protocol, action = protocols?.[protocol]?.default] = names
  if (!action) throw new Error(`no action: ${first} (${protocol} has no default action)`)
  // one after its words too, unless those words are a command passed on
  const passesOn = protocols?.[protocol]?.actions?.[action]?.command === true
  const own = passesOn ? { parts: led.parts, flags: {} } : split(led.parts, { front: false })
  const [, second, ...args] = own.parts
  const flags = { ...led.flags, ...own.flags }
  return { protocol, action, uri: [...at, relative(second)], args, ...(Object.keys(flags).length ? { flags } : {}) }
}

// The flags a request carries: those that came with it (a command sent on
// brings the sender's: a flag holds through a chain until changed), under
// those written with its own command.
const carried = (value, own) => {
  const flags = { ...(value.flags ?? {}), ...(own ?? {}) }
  return Object.keys(flags).length ? { flags } : {}
}

// A request's value, as it is given, made the form the mrepo works with:
// a command (a string, an array of parts, or { command }) interpreted, its
// protocol, action, URI and arguments beside it; a form given filled in
// ({ protocol, action, uri, args }): its URI, one segment as written, taken
// where the writer stands, the same. Once: a form is made where a request
// comes in.
export function formOf (value, protocols = {}, at = OWN) {
  if (typeof value === 'string' || Array.isArray(value)) value = { command: value }
  if (!value || typeof value !== 'object') return value
  if (value.command !== undefined && value.protocol === undefined) { const form = interpret(value.command, protocols, at); return { ...value, ...form, ...carried(value, form.flags) } }
  if (value.protocol === undefined) return value
  if (Array.isArray(value.uri)) throw new Error('not a URI: one segment, as it is written')
  return { ...value, uri: [...at, relative(value.uri)] }
}
