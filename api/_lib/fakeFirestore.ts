/* 시험 전용: firebase-admin Firestore·Messaging 중 서버 코드가 쓰는 부분만 흉내 낸 메모리 저장소 */
type Data = Record<string, unknown>

class DocSnap {
  constructor(
    public ref: DocRef,
    private _data: Data | undefined,
  ) {}
  get exists() {
    return this._data !== undefined
  }
  get id() {
    return this.ref.id
  }
  data() {
    return this._data ? { ...this._data } : undefined
  }
  get(field: string) {
    return this._data?.[field]
  }
}

class QuerySnap {
  constructor(public docs: DocSnap[]) {}
  get empty() {
    return this.docs.length === 0
  }
}

export class FakeDb {
  store = new Map<string, Data>() // 'families/ABC/alerts/x' → data
  collection(name: string) {
    return new CollRef(this, name, null)
  }
  collectionGroup(name: string) {
    return {
      get: async () => {
        const docs = [...this.store.entries()]
          .filter(([path]) => {
            const parts = path.split('/')
            return parts[parts.length - 2] === name
          })
          .map(([path, d]) => new DocSnap(this.refFromPath(path), d))
        return new QuerySnap(docs)
      },
    }
  }
  refFromPath(path: string): DocRef {
    const parts = path.split('/')
    let coll = new CollRef(this, parts[0], null)
    let doc = coll.doc(parts[1])
    for (let i = 2; i < parts.length; i += 2) {
      coll = doc.collection(parts[i])
      doc = coll.doc(parts[i + 1])
    }
    return doc
  }
  async runTransaction<T>(
    fn: (tx: { get: (r: DocRef) => Promise<DocSnap>; update: (r: DocRef, d: Data) => void }) => Promise<T>,
  ) {
    const writes: [DocRef, Data][] = []
    const result = await fn({ get: (r) => r.get(), update: (r, d) => void writes.push([r, d]) })
    for (const [r, d] of writes) await r.update(d)
    return result
  }
}

class CollRef {
  constructor(
    public db: FakeDb,
    public path: string,
    public parent: DocRef | null,
  ) {}
  doc(id: string) {
    return new DocRef(this.db, `${this.path}/${id}`, id, this)
  }
  where(field: string, op: string, value: string) {
    return new Query(this, [[field, op, value]])
  }
  get() {
    return new Query(this, []).get()
  }
}

class Query {
  constructor(
    private coll: CollRef,
    private filters: [string, string, string][],
  ) {}
  where(field: string, op: string, value: string) {
    return new Query(this.coll, [...this.filters, [field, op, value]])
  }
  async get() {
    const prefix = `${this.coll.path}/`
    const docs = [...this.coll.db.store.entries()]
      .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .filter(([, d]) =>
        this.filters.every(([f, op, v]) => {
          const x = d[f] as string
          if (x === undefined) return false
          if (op === '==') return x === v
          if (op === '>=') return x >= v
          if (op === '<') return x < v
          throw new Error(op)
        }),
      )
      .map(([p, d]) => new DocSnap(this.coll.doc(p.slice(prefix.length)), d))
    return new QuerySnap(docs)
  }
}

class DocRef {
  constructor(
    public db: FakeDb,
    public path: string,
    public id: string,
    public parent: CollRef,
  ) {}
  collection(name: string) {
    return new CollRef(this.db, `${this.path}/${name}`, this)
  }
  async get() {
    return new DocSnap(this, this.db.store.get(this.path))
  }
  async set(d: Data) {
    this.db.store.set(this.path, { ...d })
  }
  async create(d: Data) {
    if (this.db.store.has(this.path)) throw new Error('ALREADY_EXISTS')
    this.db.store.set(this.path, { ...d })
  }
  async update(d: Data) {
    const cur = this.db.store.get(this.path)
    if (!cur) throw new Error('NOT_FOUND')
    this.db.store.set(this.path, { ...cur, ...d })
  }
  async delete() {
    this.db.store.delete(this.path)
  }
}

export interface SentPush {
  token: string
  data: Record<string, string>
}

export class FakeMessaging {
  sent: SentPush[] = []
  dead = new Set<string>()
  async sendEachForMulticast(msg: { tokens: string[]; data: Record<string, string> }) {
    const responses = msg.tokens.map((token) => {
      if (this.dead.has(token))
        return { success: false, error: { code: 'messaging/registration-token-not-registered' } }
      this.sent.push({ token, data: msg.data })
      return { success: true }
    })
    return { responses, successCount: responses.filter((r) => r.success).length }
  }
}
