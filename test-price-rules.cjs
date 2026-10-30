// Run: node test-price-rules.cjs (Node 18+, no dependencies).
const assert = require('node:assert/strict');
const rules = require('./price-rules.js');
const now = new Date('2026-10-30T12:00:00Z');
const good = {price: 10, chk: '2026-10-30', src: 'https://example.com/menu', ch: 'carta'};
for (const [patch, expected] of [
  [{}, 'fresh'], [{chk: '2026-08-16'}, 'soon'],
  [{chk: '2026-08-01'}, 'soon'], [{chk: '2026-07-31'}, 'stale'],
  [{chk: '2026-02-30'}, 'none'], [{chk: '2099-01-01'}, 'none'],
  [{chk: ''}, 'none'], [{price: -1}, 'none'], [{price: NaN}, 'none'],
  [{price: '10'}, 'none'], [{src: 'javascript:alert(1)'}, 'none'], [{ch: 'unknown'}, 'none']
]) assert.equal(rules.state({...good, ...patch}, 90, 15, now), expected, JSON.stringify(patch));
console.log('PASS: 12 price validity and 75/90/91-day boundary cases');
