import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSameOrigin } from '../lib/request-origin';

function request(host: string, origin?: string) {
  const headers: Record<string,string> = {host};
  if (origin !== undefined) headers.origin=origin;
  return new Request('http://localhost:3000/api/notes', {headers});
}
test('accepts browser-facing 127.0.0.1 even if Next normalizes URL to localhost',()=>{
  assert.equal(hasSameOrigin(request('127.0.0.1:3000','http://127.0.0.1:3000')),true);
});
test('accepts same-origin localhost and origin-free local clients',()=>{
  assert.equal(hasSameOrigin(request('localhost:3000','http://localhost:3000')),true);
  assert.equal(hasSameOrigin(request('127.0.0.1:3000')),true);
});
test('rejects unrelated origins and different ports',()=>{
  assert.equal(hasSameOrigin(request('127.0.0.1:3000','https://example.com')),false);
  assert.equal(hasSameOrigin(request('127.0.0.1:3000','http://127.0.0.1:3001')),false);
});
test('rejects null, malformed and sibling-host origins',()=>{
  for(const origin of ['null','not-a-url','http://localhost:3000'])assert.equal(hasSameOrigin(request('127.0.0.1:3000',origin)),false);
});
test('rejects non-loopback hosts even if their origin matches',()=>{
  assert.equal(hasSameOrigin(request('attacker.example:3000','http://attacker.example:3000')),false);
});
test('does not trust spoofed forwarded-host headers',()=>{
  const req=request('127.0.0.1:3000','https://example.com');req.headers.set('x-forwarded-host','example.com');
  assert.equal(hasSameOrigin(req),false);
});
