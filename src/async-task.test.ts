import test from 'node:test';
import assert from 'node:assert/strict';
import { LatestTask } from './async-task';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('clearing or closing a wizard prevents a delayed source read from restoring prepared state', async () => {
  const source = new LatestTask();
  const delayed = deferred<string>();
  let prepared: string | null = null;
  const pending = source.run(() => delayed.promise, value => { prepared = value; }, () => { prepared = 'error'; });
  source.invalidate(); // Clear files or close: the old read has lost ownership.
  prepared = null;
  delayed.resolve('the earlier source export');
  await pending;
  assert.equal(prepared, null);
});

test('a superseded source rejection cannot erase a later successful source', async () => {
  const source = new LatestTask();
  const oldRead = deferred<string>();
  let prepared: string | null = null;
  let error = '';
  const oldPending = source.run(() => oldRead.promise, value => { prepared = value; }, value => { error = String(value); prepared = null; });
  await source.run(async () => 'the newer export', value => { prepared = value; }, value => { error = String(value); });
  oldRead.reject(new Error('The earlier read failed late.'));
  await oldPending;
  assert.equal(prepared, 'the newer export');
  assert.equal(error, '');
});

test('changing source slot invalidates both a pending preparation and a pending verification', async () => {
  const source = new LatestTask();
  const verification = new LatestTask();
  const slowSource = deferred<string>();
  const slowReadback = deferred<string>();
  let prepared = '';
  let result = '';
  const preparation = source.run(() => slowSource.promise, value => { prepared = value; }, () => {});
  const checking = verification.run(() => slowReadback.promise, value => { result = value; }, () => {});
  source.invalidate(); verification.invalidate();
  await source.run(async () => 'new slot context', value => { prepared = value; }, () => {});
  slowSource.resolve('old slot context'); slowReadback.resolve('old match');
  await Promise.all([preparation, checking]);
  assert.equal(prepared, 'new slot context');
  assert.equal(result, '');
});

test('only the most recently selected readback may display a verification result', async () => {
  const verification = new LatestTask();
  const oldReadback = deferred<string>();
  let result = '';
  const previous = verification.run(() => oldReadback.promise, value => { result = value; }, () => {});
  await verification.run(async () => 'new mismatch', value => { result = value; }, () => {});
  oldReadback.resolve('old exact match');
  await previous;
  assert.equal(result, 'new mismatch');
});
