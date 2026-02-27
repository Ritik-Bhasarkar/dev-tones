import * as crypto from 'crypto';

export function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) { return undefined; }
  return arr[Math.floor(Math.random() * arr.length)];
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
