/**
 * Adaptive download pool.
 *
 * Browsers multiplex all requests to one host over a single HTTP/2 / QUIC
 * connection, so "more parallel requests" is not always faster — on many
 * networks 2 parallel 8 MB requests beat 4 or 8. The best value depends on the
 * user's network, so instead of a fixed number this pool measures throughput
 * and hill-climbs the concurrency up or down while the download runs.
 */

export type PoolTask = (onBytes: (n: number) => void) => Promise<void>;

export interface AdaptivePoolOptions {
  /**
   * Returns the next task, `null` when there will never be more work, or
   * `undefined` when there is nothing to do right now (call `poke()` later).
   * Tasks call `onBytes` as data arrives so throughput is measured continuously.
   */
  next: () => PoolTask | null | undefined;
  min: number;
  max: number;
  initial: number;
  /** Measurement window length. */
  windowMs?: number;
  signal?: AbortSignal;
  /** Optional debug label for console logging. */
  label?: string;
}

export interface AdaptivePoolController {
  /** Resolves when the pool is finished and all tasks have settled. */
  done: Promise<void>;
  /** Tells the pool new work may be available. */
  poke: () => void;
  /** Stops scheduling new tasks; `done` resolves once running tasks settle. */
  close: () => void;
}

/** Minimum relative gain required to keep a concurrency change. */
const IMPROVEMENT = 1.08;
/** Windows to stay put after a failed probe before trying again. */
const SETTLE_WINDOWS = 6;

export function createAdaptivePool(opts: AdaptivePoolOptions): AdaptivePoolController {
  const { min, max, signal, label } = opts;
  const windowMs = opts.windowMs ?? 4000;

  let poke: () => void = () => {};
  let close: () => void = () => {};

  const done = new Promise<void>((resolve, reject) => {
    let target = Math.min(max, Math.max(min, opts.initial));
    let active = 0;
    let exhausted = false;
    let error: unknown = null;
    let windowBytes = 0;
    // True if the pool ran out of work during the current window — throughput
    // then reflects demand, not network capacity, so the window is ignored.
    let starvedThisWindow = false;

    // Hill-climbing state
    let direction = 1;
    let lastRate = 0;
    let settle = 0;

    const clamp = (n: number) => Math.min(max, Math.max(min, n));

    const finish = () => {
      if (active > 0) return;
      if (error) {
        clearInterval(timer);
        reject(error);
      } else if (exhausted) {
        clearInterval(timer);
        resolve();
      }
    };

    const fill = () => {
      while (active < target && !exhausted && !error) {
        if (signal?.aborted) {
          error = Object.assign(new Error('İndirme iptal edildi.'), { name: 'AbortError' });
          break;
        }
        const task = opts.next();
        if (task === null) {
          exhausted = true;
          break;
        }
        if (task === undefined) {
          starvedThisWindow = true;
          break;
        }
        active++;
        task((n) => {
          windowBytes += n;
        })
          .catch((err) => {
            if (!error) error = err;
          })
          .finally(() => {
            active--;
            fill();
            finish();
          });
      }
      finish();
    };

    const timer = setInterval(() => {
      const rate = windowBytes / (windowMs / 1000);
      const starved = starvedThisWindow;
      windowBytes = 0;
      starvedThisWindow = false;
      if (exhausted || error || starved) return;

      if (settle > 0) {
        settle--;
        if (settle === 0) {
          // Probe again in the current direction.
          lastRate = rate;
          const probe = clamp(target + direction);
          if (probe === target) direction = -direction;
          target = clamp(target + direction);
          fill();
        }
        return;
      }

      if (rate > lastRate * IMPROVEMENT) {
        // The last change helped — keep going the same way.
        lastRate = rate;
        const nextTarget = clamp(target + direction);
        if (nextTarget === target) {
          direction = -direction;
          settle = SETTLE_WINDOWS;
        } else {
          target = nextTarget;
        }
      } else {
        // No gain — undo the last step, flip direction and settle for a while.
        target = clamp(target - direction);
        direction = -direction;
        settle = SETTLE_WINDOWS;
        lastRate = rate;
      }
      if (label) {
        console.debug(`[AdaptivePool:${label}] ${(rate * 8 / 1e6).toFixed(1)} Mbit/s → concurrency ${target}`);
      }
      fill();
    }, windowMs);

    poke = fill;
    close = () => {
      exhausted = true;
      finish();
    };

    // Defer the first fill so `poke`/`close` are assigned before tasks run.
    queueMicrotask(fill);
  });

  return { done, poke: () => poke(), close: () => close() };
}

/** Runs a finite set of tasks (`next` returns `null` when done) adaptively. */
export function runAdaptivePool(opts: AdaptivePoolOptions): Promise<void> {
  return createAdaptivePool(opts).done;
}
