import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  test('applies defaults to an empty environment', () => {
    assert.deepEqual(loadConfig({}), {
      PORT: 3000,
      HEARTBEAT_PATH: '/health',
      FORWARD_TARGET_HEADER: 'x-forward-url',
      TRUSTED_IPS: [],
      TRUST_PROXY: false,
      UPSTREAM_TIMEOUT_MS: 30_000,
      MAX_BODY_BYTES: 10_485_760,
    });
  });

  test('coerces numbers and splits lists', () => {
    const config = loadConfig({ PORT: '0', TRUSTED_IPS: ' 10.0.0.1, ,10.0.0.2 ', TRUST_PROXY: '10.0.0.1, 10.0.0.2' }); // review-gate: ok (RFC 1918 test addresses)

    assert.equal(config.PORT, 0);
    assert.deepEqual(config.TRUSTED_IPS, ['10.0.0.1', '10.0.0.2']); // review-gate: ok
    assert.deepEqual(config.TRUST_PROXY, ['10.0.0.1', '10.0.0.2']); // review-gate: ok
  });

  test('reads TRUST_PROXY booleans', () => {
    assert.equal(loadConfig({ TRUST_PROXY: 'true' }).TRUST_PROXY, true);
    assert.equal(loadConfig({ TRUST_PROXY: 'no' }).TRUST_PROXY, false);
  });

  test('names every invalid variable', () => {
    assert.throws(
      () => loadConfig({ PORT: 'abc', UPSTREAM_TIMEOUT_MS: '-1' }),
      (error: Error) => /^Invalid configuration: PORT: .*UPSTREAM_TIMEOUT_MS: /.test(error.message),
    );
  });
});
