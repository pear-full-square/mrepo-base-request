// A request's flags: what is asked of the way a request is handled, beside
// what it asks for. Written with a command after the word --flags, space
// separated, to the end of the command or to a closing --:
//   crud/read swarms/* --flags log=debug
//   --flags log=debug -- haicc host crud/read swarms/*
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

// A command's parts with its flag lists taken out:
//   a list in front, closed by --      the command's own, it follows
//   a list after the command's words   the command's own, to the end or --
//                                      (not looked for when the words after
//                                      the URI are a command to pass on:
//                                      a list there is that command's)
// -> { parts, flags }
export function split (parts, { front = true, after = true } = {}) {
  let flags = {}
  if (front && parts[0] === WORD) {
    const end = parts.indexOf(END)
    if (end < 0 || end === parts.length - 1) throw new Error(`not a command: flags and no command (${WORD} <flag>... ${END} <command>)`)
    flags = flagsOf(parts.slice(1, end))
    parts = parts.slice(end + 1)
  }
  if (after) {
    const i = parts.indexOf(WORD, 1)
    if (i > 0) {
      const end = parts.indexOf(END, i)
      flags = { ...flags, ...flagsOf(parts.slice(i + 1, end < 0 ? parts.length : end)) }
      parts = [...parts.slice(0, i), ...(end < 0 ? [] : parts.slice(end + 1))]
    }
  }
  return { parts, flags }
}
