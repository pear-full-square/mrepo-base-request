// A repository's boxes, as layers:
// `inbox` and `outbox`, non-atomic (git on disk), streaming: a record a
// document, its name its offset, kept in buckets; nothing removed
// (housekeeping later). What arrives in the inbox is an envelope: its topic
// this repository's inbox (/<name>/inbox), its value the core record (the
// pre-filled form).
// The boxes' folders are streaming folders (mycelium-container-document):
//   drop(dir, uri, core)     THE way a record is dropped into an mrepo's
//                            inbox, by everyone: its offset given under the
//                            folder's lock (the time it arrives), stamped on
//                            the core and its envelope, the file written:
//                            -> its offset, the sender's confirmation
//   answered(dir, offset)    its completed form waited for in the mrepo's
//                            outbox folder, under the same offset
//   post(ctx)                the inbox folder's new records committed: the
//                            folder is the inbox layer's working tree
//                            (<work>/mrepos/<name>/inbox/: many inputs drop
//                            records, the runtime commits what came after
//                            the layer's last)
//   post(ctx, record)        a record committed into the inbox as it is (a
//                            store on git alone: no folder): its offset the
//                            record's, or given by the mrepo's clock
//   inboxFolder(work, name)  that folder (name: the setting's by default)
import { join } from 'bare-path'
import { existsSync, readFileSync, watch } from 'bare-fs'
import { stream, documents, nameOf, BUCKETS } from 'mycelium-container-document'
import { wrap, stamp, tick } from './record.js'
import * as json from 'mycelium-value-json'
import { viewOf, setting } from './view.js'
import { layer, AUTHOR, CONFIG } from './layer.js'

export const INBOX = '/inbox'
export const OUTBOX = '/outbox'
// A box's folder: a streaming folder, its levels its layer's config's.
// (streamOf: any folder of an mrepo's that is one)
export const streamOf = folder => box(folder)
const box = folder => {
  let buckets = BUCKETS
  // catch: no config there, or none that reads: the default
  try { buckets = JSON.parse(readFileSync(join(folder, `${CONFIG}.json`), 'utf8')).stream ?? BUCKETS } catch {}
  return stream(folder, json, { buckets })
}
export const inboxFolder = (work, name = setting(work).name) => box(join(viewOf(work, name), 'inbox'))
// An mrepo's own inbox folder, by its directory.
export const inboxOf = dir => box(join(dir, 'inbox'))
// Its outbox folder: the outbox layer's records, written after each commit.
export const outboxOf = dir => box(join(dir, 'outbox'))

// A queue beside an mrepo (a component's side boxes): a folder of
// documents, each taken and removed, named by a key of the exchange's own;
// no stream: nothing stays, nothing is ordered.
//   queueOf(folder)            its documents (JSON)
//   keyed(topic, inner, key)   an envelope and its record under that key
export const queueOf = folder => documents(folder, json)
export const keyed = (topic, inner, key) => ({ ...wrap(topic, { ...inner, key }), key })

// The mrepo's clock: an offset given, never two the same there: its inbox
// folder's (the one lock every sender takes), the runtime's (ctx.offset).
export const offsetOf = ctx => ctx.offset ? ctx.offset() : tick()

export const drop = (dir, uri, core) => inboxOf(dir).create(offset => wrap(`/${uri}/inbox`, { ...core, offset }))

// -> the record as stored (its text), null when none came in time
export async function answered (dir, offset, { timeout = 120, every = 200 } = {}) {
  const out = outboxOf(dir)
  let arrived = () => {}
  let watcher = null
  // catch: a folder that cannot be watched is looked at instead: every `every`
  try { watcher = watch(out.folder, { recursive: true }, () => arrived()); watcher.on('error', () => {}) } catch {}
  try {
    for (const end = Date.now() + timeout * 1000; !out.has(offset);) {
      if (Date.now() >= end) return null
      await new Promise(resolve => { const t = setTimeout(resolve, Math.min(every, Math.max(0, end - Date.now()))); arrived = () => { clearTimeout(t); resolve() } })
    }
    return readFileSync(out.fileOf(offset), 'utf8')
  } finally { watcher?.close() }
}

// A layer made when first needed (an orphan branch, under the layer rules).
export async function ensure ({ backend, writer }, branch) {
  if (!(await backend.listBranches()).some(([b]) => b === branch)) await writer.createLayer(branch, `Create ${branch}`, { author: AUTHOR })
}

export async function post (ctx, rec = null) {
  await ensure(ctx, 'inbox')
  const box = layer(ctx, 'inbox')
  let fresh
  if (rec) {
    const offset = rec.offset ?? offsetOf(ctx)
    fresh = (await box.has(nameOf(offset))) ? [] : [[nameOf(offset), rec.offset == null ? stamp(rec, offset) : rec]]
  } else {
    // the folder's records after the layer's last: a record is written
    // under the folder's lock, so none appears below one already there
    const folder = ctx.dir ? inboxOf(ctx.dir) : inboxFolder(ctx.work, ctx.name)
    if (!existsSync(folder.folder)) return []
    const last = (await box.list()).pop() ?? null
    fresh = folder.list({ after: last === null ? null : Number(last), ascending: true }).map(o => [nameOf(o), folder.read(o)])
  }
  // A commit lost to another writer of the inbox (compare-and-swap) is made
  // again on the new head.
  for (let tries = 0; fresh.length; tries++) {
    try {
      const c = await ctx.writer.change('inbox')
      for (const [n, r] of fresh) await c.put(await box.within(n), json.encode(r))
      await c.commit(`Inbox: ${fresh.map(([n]) => n).join(', ')}`, { author: AUTHOR })
      break
    } catch (err) {
      if (tries >= 5 || !/expected/.test(err.message)) throw err
    }
  }
  return fresh.map(([n]) => n)
}
