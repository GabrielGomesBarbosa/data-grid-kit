/**
 * The cursors of a cursor-paginated API, by block. A response that carries `pageInfo.nextCursor` tells where to
 * continue after the *last* block of its request; the next block is asked for with that cursor. Blocks are numbered
 * from 0 and block 0 needs none.
 */
export class CursorTrail {
  private after = new Map<number, unknown>()
  /** a response has carried a cursor: the source paginates by cursor, so blocks can only be fetched in order */
  active = false

  /** `cursor` continues after `block` */
  set(block: number, cursor: unknown) {
    this.after.set(block, cursor)
    this.active = true
  }

  /** can `block` be requested right now? */
  canFetch(block: number): boolean {
    return !this.active || block === 0 || this.after.has(block - 1)
  }

  /** the cursor to send with a request that starts at `block` */
  cursorFor(block: number): unknown {
    return block === 0 ? undefined : this.after.get(block - 1)
  }

  /**
   * The block to fetch to get closer to `block`: the one right after the last block whose cursor is known. Requests walk
   * the chain one block at a time, each carrying the previous cursor.
   */
  nextToward(block: number): number {
    for (let b = block - 1; b >= 0; b--) if (this.after.has(b)) return b + 1
    return 0
  }

  /** a new query: the old cursors point into another result set */
  reset() {
    this.after.clear()
  }
}
