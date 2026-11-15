// A request's flags: what is asked of the way a request is handled, beside
// what it asks for. Written after a command's URI, after the word --flags,
// space separated: the flags of that step. -- says where what follows
// starts:
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

// Whether a word is written as a flag: key=value, or a flag that stands
// alone. What ends a list that has no closing --.
const written = word => /^[a-z][a-z0-9-]*=/.test(word) || FLAGS[word] === null

// A command's parts with its flag list taken out. The list follows the
// command's URI (its first word, when no URI is written): the flags are
// that step's.
//   a command of its own       the list runs to the end, or to a closing
//                              --, its arguments after that; one after
//                              its arguments is taken the same way
//   a command that passes on   (command: true; haicc's goto) the list
//   the words after its URI    stands right after the URI; -- says where
//                              the next command starts, and is optional:
//                              without it the list ends at the first
//                              word not written as a flag (so a flag
//                              there is none of needs the --)
// -> { parts, flags }
export function split (parts, { command = false } = {}) {
  const i = command ? ([1, 2].find(k => parts[k] === WORD) ?? -1) : parts.indexOf(WORD, 1)
  if (i < 0) return { parts, flags: {} }
  const end = parts.indexOf(END, i)
  let to = end < 0 ? parts.length : end
  let next = end < 0 ? parts.length : end + 1
  if (command) {
    // a -- behind a further list is that list's, not this one's
    const further = parts.indexOf(WORD, i + 1)
    if (end < 0 || (further >= 0 && further < end)) {
      to = i + 1
      while (to < parts.length && written(parts[to])) to++
      next = to
    }
  }
  return { parts: [...parts.slice(0, i), ...parts.slice(next)], flags: flagsOf(parts.slice(i + 1, to)) }
}
