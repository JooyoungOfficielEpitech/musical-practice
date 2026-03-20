/**
 * Pre-allocated circular buffer for audio samples.
 * Eliminates GC pressure by reusing a fixed Float32Array.
 */
export class RingBuffer {
  private readonly buffer: Float32Array;
  private readPos = 0;
  private writePos = 0;
  private count = 0;

  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  get availableRead(): number {
    return this.count;
  }

  /**
   * Write samples into the buffer. If capacity is exceeded,
   * oldest data is overwritten (circular).
   */
  write(data: Float32Array): void {
    const len = data.length;
    if (len === 0) return;

    if (len >= this.capacity) {
      // Data larger than buffer — keep only the most recent `capacity` samples
      const offset = len - this.capacity;
      this.buffer.set(data.subarray(offset));
      this.readPos = 0;
      this.writePos = 0;
      this.count = this.capacity;
      return;
    }

    // Check if write wraps around
    const spaceToEnd = this.capacity - this.writePos;
    if (len <= spaceToEnd) {
      this.buffer.set(data, this.writePos);
    } else {
      // Split write across boundary
      this.buffer.set(data.subarray(0, spaceToEnd), this.writePos);
      this.buffer.set(data.subarray(spaceToEnd), 0);
    }

    this.writePos = (this.writePos + len) % this.capacity;
    this.count = Math.min(this.count + len, this.capacity);

    // If we overwrote data, advance read pointer
    if (this.count === this.capacity) {
      this.readPos = this.writePos;
    }
  }

  /**
   * Read samples from the buffer, advancing the read pointer.
   * Returns at most `availableRead` samples.
   */
  read(size: number): Float32Array {
    const toRead = Math.min(size, this.count);
    if (toRead === 0) return new Float32Array(0);

    const result = this.peekInternal(toRead);
    this.readPos = (this.readPos + toRead) % this.capacity;
    this.count -= toRead;
    return result;
  }

  /**
   * Read samples without advancing the read pointer.
   */
  peek(size: number): Float32Array {
    const toRead = Math.min(size, this.count);
    if (toRead === 0) return new Float32Array(0);
    return this.peekInternal(toRead);
  }

  /**
   * Advance the read pointer without copying data.
   */
  advance(samples: number): void {
    const toSkip = Math.min(samples, this.count);
    this.readPos = (this.readPos + toSkip) % this.capacity;
    this.count -= toSkip;
  }

  /**
   * Reset the buffer to empty state.
   */
  clear(): void {
    this.readPos = 0;
    this.writePos = 0;
    this.count = 0;
  }

  private peekInternal(size: number): Float32Array {
    const spaceToEnd = this.capacity - this.readPos;
    if (size <= spaceToEnd) {
      // Contiguous read — return a copy of the slice
      return this.buffer.slice(this.readPos, this.readPos + size);
    }
    // Wrap-around read — need to stitch
    const result = new Float32Array(size);
    result.set(this.buffer.subarray(this.readPos, this.capacity));
    result.set(this.buffer.subarray(0, size - spaceToEnd), spaceToEnd);
    return result;
  }
}
