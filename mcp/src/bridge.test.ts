import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createBridge } from './bridge.ts';

describe('bridge pairing', () => {
  it('issues a token only for a registered code and redeems it once', () => {
    const bridge = createBridge();
    assert.throws(() => bridge.issue('MISSING', 'Claude'), /unknown or expired/);
    bridge.registerPair('ABCD2345', Date.now() + 60_000);
    const issued = bridge.issue('ABCD2345', 'Claude');
    assert.match(issued.bindToken, /^spx_bind_[a-f0-9]{48}$/);
    assert.equal(bridge.isRedeemed(issued.bindToken), false);
    const redeemed = bridge.redeem('ABCD2345', issued.bindToken);
    assert.equal(redeemed.agentName, 'Claude');
    assert.equal(bridge.isRedeemed(issued.bindToken), true);
    bridge.unbind(issued.bindToken);
    assert.equal(bridge.isRedeemed(issued.bindToken), false);
  });

  it('accepts a pair call that arrives just before the extension registers the code', async () => {
    const bridge = createBridge();
    const pending = bridge.issueWhenRegistered('LATE1234', 'Ada', 1000);
    setTimeout(() => bridge.registerPair('LATE1234', Date.now() + 60_000), 200);
    const issued = await pending;
    assert.match(issued.bindToken, /^spx_bind_[a-f0-9]{48}$/);
    assert.equal(issued.agentName, 'Ada');
  });

  it('refuses wallet calls before the extension is connected', async () => {
    const bridge = createBridge();
    const result = await bridge.request({
      id: '1',
      method: 'get_addresses',
      params: { bindToken: 'spx_bind_' + 'ab'.repeat(24) },
    });
    assert.equal(result.ok, false);
  });
});
