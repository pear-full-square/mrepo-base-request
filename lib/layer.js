// Records in a layer of the repository (a git branch): one JSON document a
// record, <name>.json, its name its offset (13 digits). Read from the
// repository as it stands; each write one commit, by the store's single
// writer (the runtime).
// A streaming layer (STREAMS: the inbox, the outbox, request/done: what only
// grows) keeps its records in buckets, as a streaming folder does
// (mycelium-container-document): /<layer>/17953/179531/<name>.json, the
// levels its config's (`stream`, [5, 6] by default); a record is named by
// its offset alone. The others (pending, execute: a handful of records) are
// flat, the same names.
import * as json from 'mycelium-value-json'
import { placeOf, isOffset, BUCKETS } from 'mycelium-container-document'

export const STREAMS = ['inbox', 'outbox', 'request/done']

export const AUTHOR = { name: 'mrepo', email: 'mrepo@localhost' }
// A layer's config (its mode, what it is for), committed with it when it is
// built from its structure: not one of its records.
export const CONFIG = '.layer'

// The names a layer's commits added, in the order of its commit chain (first
// parent, from its first commit to its head); within one commit, by name.
// Remembered per backend and layer: when the head moves, only the new commits
// are walked (back to the head walked last); the whole chain once, after a
// start.
const remembered = new WeakMap()
async function arrivals (backend, branch) {
  const head = Object.fromEntries(await backend.listBranches())[branch]
  if (!head) return []
  const memo = remembered.get(backend) ?? remembered.set(backend, new Map()).get(backend)
  const known = memo.get(branch)
  if (known?.head === head) return known.order
  const fresh = []
  let base = null
  for (let c = head; c;) {
    if (known && c === known.head) { base = known; break }
    const commit = await backend.readCommit(c)
    fresh.push(commit)
    c = commit.parents[0]
  }
  const namesOf = async tree => new Set((await backend.readTree(tree)).filter(e => e.type === 'blob' && e.name.endsWith('.json') && !e.name.startsWith('.')).map(e => e.name.slice(0, -'.json'.length)))
  const order = base ? [...base.order] : []
  let before = base ? base.names : new Set()
  for (const commit of fresh.reverse()) {
    const now = await namesOf(commit.tree)
    order.push(...[...now].filter(n => !before.has(n)).sort())
    before = now
  }
  memo.set(branch, { head, order, names: before })
  return order
}

// A streaming layer's levels: its config's, read once a repository.
const levels = new WeakMap()
function bucketsOf (repo, branch) {
  const memo = levels.get(repo) ?? levels.set(repo, new Map()).get(repo)
  // catch: no config, or none that reads: the default
  if (!memo.has(branch)) memo.set(branch, repo.read(`/${branch}/${CONFIG}.json`).then(b => JSON.parse(b.toString()).stream ?? BUCKETS, () => BUCKETS))
  return memo.get(branch)
}

export function layer ({ repo, writer, backend }, branch) {
  const streaming = STREAMS.includes(branch)
  // a record's document: in the layer (what a change writes), in the repository (what is read)
  const within = async name => `/${streaming ? placeOf(name, await bucketsOf(repo, branch)) : name}.json`
  const pathOf = async name => `/${branch}${await within(name)}`
  const named = found => found.filter(([p, n]) => n.type === 'blob' && p.endsWith('.json'))
    .map(([p]) => p.slice(p.lastIndexOf('/') + 1, -'.json'.length)).filter(n => !n.startsWith('.'))
  const self = {
    branch,
    streaming,
    pathOf,
    within,
    // The names it holds, in the order they arrived: a streaming layer's
    // natural order, its offsets ascending; another's, its commit chain.
    async arrived () {
      if (streaming) return self.list()
      const here = new Set(await self.list())
      return [...new Set((await arrivals(backend, branch)).filter(n => here.has(n)))]
    },
    // (after: a streaming layer's names greater than this one: past a pointer)
    async list ({ after = null } = {}) {
      if (!streaming) return named(await repo.select(`/${branch}/*`)).sort()
      const depth = (await bucketsOf(repo, branch)).length
      // catch: a bucket that is none (no tree there): nothing in it
      const names = named(await repo.select(`/${branch}${'/*'.repeat(depth + 1)}`).catch(() => [])).filter(isOffset).sort()
      return after === null ? names : names.filter(n => n > after)
    },
    has: async name => (await repo.find(await pathOf(name))) !== null,
    read: async name => json.decode(await repo.read(await pathOf(name))),
    // (also: other documents of the layer written in the same commit, by
    // their path in it: { '.pointer': value })
    async put (name, value, message = `${name}`, also = {}) {
      const c = await writer.change(branch)
      await c.put(await within(name), json.encode(value))
      for (const [n, v] of Object.entries(also)) await c.put(`/${n}.json`, json.encode(v))
      return c.commit(message, { author: AUTHOR })
    },
    async remove (name, message = `${name} out`) {
      const c = await writer.change(branch)
      c.remove(await within(name))
      return c.commit(message, { author: AUTHOR })
    }
  }
  return self
}
