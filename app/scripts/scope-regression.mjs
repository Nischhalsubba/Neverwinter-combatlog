import assert from 'node:assert/strict';
import { File } from 'node:buffer';

const messages = [];
const waiters = [];
globalThis.self = {
  postMessage(message) {
    messages.push(message);
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      const waiter = waiters[index];
      if (!waiter.predicate(message)) continue;
      waiters.splice(index, 1);
      waiter.resolve(message);
    }
  }
};

const waitFor = (predicate, timeoutMs = 5000) => new Promise((resolve, reject) => {
  const existing = messages.find(predicate);
  if (existing) return resolve(existing);
  const timer = setTimeout(() => reject(new Error('Timed out waiting for worker message')), timeoutMs);
  waiters.push({
    predicate,
    resolve(message) {
      clearTimeout(timer);
      resolve(message);
    }
  });
});

await import('../src/workers/fast-parse-worker.js');

const lines = [
  '26:04:15:00:00:00.000::Alice,P[1 Alice],Alice,P[1 Alice],Dragon,C[9 Dragon_Boss],Arcane Strike,Power_A,Arcane,Critical|CombatAdvantage,1000,1000',
  '26:04:15:00:00:01.000::Bob,P[2 Bob],Bob,P[2 Bob],Dragon,C[9 Dragon_Boss],Cold Strike,Power_B,Cold,Flank,800,800',
  '26:04:15:00:00:02.000::Alice,P[1 Alice],Alice,P[1 Alice],Goblin,C[10 Goblin_Standard],Arcane Strike,Power_A,Arcane,,500,500',
  '26:04:15:00:00:03.000::Bob,P[2 Bob],Bob,P[2 Bob],Dragon,C[9 Dragon_Boss],Cold Strike,Power_B,Cold,Critical,200,200',
  '26:04:15:00:00:20.000::Alice,P[1 Alice],Alice,P[1 Alice],Goblin,C[10 Goblin_Standard],Arcane Strike,Power_A,Physical,,300,300'
];

const file = new File([lines.join('\n')], 'scope-fixture.log', { type: 'text/plain' });
self.onmessage({ data: { type: 'parse', file } });
const done = await waitFor(message => message.type === 'done');
assert.equal(done.summary.damage, 2800);
assert.equal(done.summary.encounters.length, 2);
assert.equal(done.summary.encounters[0].type, 'boss');

self.onmessage({ data: { type: 'scope-report', requestId: 1, scope: { type: 'boss', id: 1, targetOnly: false } } });
const windowReport = (await waitFor(message => message.type === 'scope-report' && message.requestId === 1)).report;
assert.equal(windowReport.damage, 2500);
assert.equal(windowReport.players.find(player => player.ref === 'P[1 Alice]').damage, 1500);
assert.equal(windowReport.players.find(player => player.ref === 'P[2 Bob]').damage, 1000);

self.onmessage({ data: { type: 'scope-report', requestId: 2, scope: { type: 'boss', id: 1, targetOnly: true } } });
const bossOnly = (await waitFor(message => message.type === 'scope-report' && message.requestId === 2)).report;
assert.equal(bossOnly.damage, 2000);
assert.equal(bossOnly.players.find(player => player.ref === 'P[1 Alice]').damage, 1000);
assert.equal(bossOnly.players.find(player => player.ref === 'P[2 Bob]').damage, 1000);
assert.equal(Math.round(bossOnly.players[0].damageShare + bossOnly.players[1].damageShare), 100);

self.onmessage({ data: { type: 'raw-page', requestId: 3, options: { limit: 20, scope: { type: 'boss', id: 1, targetOnly: true } } } });
const page = (await waitFor(message => message.type === 'raw-page' && message.requestId === 3)).page;
assert.equal(page.rows.length, 3);
assert.ok(page.rows.every(row => row.targetRef === 'C[9 Dragon_Boss]'));

console.log('Scope regression passed.');
