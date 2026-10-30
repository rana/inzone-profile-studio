/** A completed read may commit only while it still owns the active operation. */
export class LatestTask {
  private generation = 0;

  invalidate(): void { this.generation += 1; }

  async run<T>(read: () => Promise<T>, commit: (value: T) => void, fail: (error: unknown) => void): Promise<void> {
    const generation = ++this.generation;
    try {
      const value = await read();
      if (generation === this.generation) commit(value);
    } catch (error) {
      if (generation === this.generation) fail(error);
    }
  }
}
