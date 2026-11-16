// A request's flags: what is asked of the way a request is handled, beside
// what it asks for. Written after a command's URI, after the word --flags,
// space separated: the flags of that step. The list is closed by -- or by
// the end of the command:
//   crud/read swarms/* --flags log=debug
//   haicc host --flags log=debug -- crud/read swarms/*
// A flag stands alone (its value true) or carries a value, key=value, no
// space. In a request's form they are a map: { log: 'debug' }.
// Which flags there are is an enumeration, FLAGS: a flag's name, and the
// values it takes (null: it stands alone). One that is not among them, or
// a value its flag does not take, is ignored, with a warning in the
// request's log: sorted() says which.
export const WORD = '--flags'
export const END = '--'
export const FLAGS = {
  // how much the request's log holds: info without the flag
  log: ['info', 'verbose', 'debug']
}

// The words of a flag list -> the map as written.
export function flagsOf (words) {
  const flags = {}
  for (const word of words) {
    const i = word.indexOf('=')
    if (i > 0) flags[word.slice(0, i)] = word.slice(i + 1)
    else flags[word] = true
  }
  return flags
}

// A map of flags as written -> { flags: those there are, with a value
// they take; ignored: [{ flag, value, why }] the others }.
export function sorted (written = {}) {
  const flags = {}
  const ignored = []
  for (const [flag, value] of Object.entries(written ?? {})) {
    if (!(flag in FLAGS)) ignored.push({ flag, value, why: `no flag: ${flag} (${Object.keys(FLAGS).sort().join(', ')})` })
    else if (FLAGS[flag] === null ? value !== true : !FLAGS[flag].includes(value)) ignored.push({ flag, value, why: FLAGS[flag] === null ? `${flag} takes no value` : `${flag}=${value === true ? '' : value}: not one of ${FLAGS[flag].join(', ')}` })
    else flags[flag] = value
  }
  return { flags, ignored }
}

// A command's parts with its flag list taken out. The list follows the
// command's URI (its first word, when no URI is written): the flags are
// that step's. It is closed by -- or by the end of the command, nothing
// else: every word in between is a flag (one there is none of is ignored,
// with a warning: sorted).
//   a command of its own       its arguments go on after the --; a list
//                              after its arguments is taken the same way
//   a command that passes on   (command: true; haicc's goto) the list
//   the words after its URI    stands right after the URI; the next
//                              command starts after the --, its words
//                              left as written: a list among them is its
//                              own
// -> { parts, flags, listed: whether a list was written }
export function split (parts, { command = false } = {}) {
  const i = command ? ([1, 2].find(k => parts[k] === WORD) ?? -1) : parts.indexOf(WORD, 1)
  if (i < 0) return { parts, flags: {}, listed: false }
  const end = parts.indexOf(END, i)
  const to = end < 0 ? parts.length : end
  return { parts: [...parts.slice(0, i), ...parts.slice(to + 1)], flags: flagsOf(parts.slice(i + 1, to)), listed: true }
}
