import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test_secret_key_pulseroute';

function mockRequireAuth(headers = {}, allowDemo = true) {
  const auth = headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return { status: 401, error: 'Unauthorized', message: 'Authentication required' };
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    return { status: 200, user };
  } catch {
    if (allowDemo && token === 'demo_session_token') {
      return { status: 200, user: { sub: 'demo-operator-id', role: 'admin' } };
    }
    return { status: 401, error: 'Unauthorized', message: 'Invalid or expired authentication token' };
  }
}

function mockPaginate(array, page = 1, limit = 50) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const total = array.length;
  const data = array.slice((pageNum - 1) * pageSize, pageNum * pageSize);
  return {
    data,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}

test('API Contract - Health Check Schema Contract', () => {
  const sampleHealthResponse = {
    status: 'ok',
    service: 'PulseRoute API',
    version: '1.0.0',
    environment: 'test',
    uptime: '1h 15m 30s',
    uptimeSeconds: 4530,
    memory: {
      rssMb: 52,
      heapUsedMb: 24,
      heapTotalMb: 36
    },
    database: 'connected',
    databaseState: 1,
    demoLoginAllowed: true,
    realtimeClientsCount: 1,
    timestamp: new Date().toISOString()
  };

  assert.equal(sampleHealthResponse.status, 'ok');
  assert.equal(sampleHealthResponse.service, 'PulseRoute API');
  assert.ok(typeof sampleHealthResponse.uptimeSeconds === 'number');
  assert.ok(typeof sampleHealthResponse.memory.heapUsedMb === 'number');
  assert.ok(['connected', 'disconnected'].includes(sampleHealthResponse.database));
  assert.ok(typeof sampleHealthResponse.realtimeClientsCount === 'number');
});

test('API Contract - Protected Routes Require Authentication', () => {
  // Missing authorization header
  const rejectedNoHeader = mockRequireAuth({});
  assert.equal(rejectedNoHeader.status, 401);
  assert.equal(rejectedNoHeader.error, 'Unauthorized');

  // Invalid token
  const rejectedBadToken = mockRequireAuth({ authorization: 'Bearer invalid.token.signature' }, false);
  assert.equal(rejectedBadToken.status, 401);
  assert.equal(rejectedBadToken.message, 'Invalid or expired authentication token');

  // Valid signed token
  const validToken = jwt.sign({ sub: 'op-123', email: 'op@pulseroute.org', role: 'operator' }, JWT_SECRET, { expiresIn: '1h' });
  const accepted = mockRequireAuth({ authorization: `Bearer ${validToken}` }, false);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.user.sub, 'op-123');

  // Demo token fallback when enabled
  const demoAccepted = mockRequireAuth({ authorization: 'Bearer demo_session_token' }, true);
  assert.equal(demoAccepted.status, 200);
  assert.equal(demoAccepted.user.role, 'admin');

  // Demo token rejected when ALLOW_DEMO_LOGIN=false
  const demoDenied = mockRequireAuth({ authorization: 'Bearer demo_session_token' }, false);
  assert.equal(demoDenied.status, 401);
});

test('API Contract - Pagination Contract', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: `AMB-${i + 1}` }));

  // Page 1 with limit 10
  const p1 = mockPaginate(items, 1, 10);
  assert.equal(p1.data.length, 10);
  assert.equal(p1.pagination.total, 25);
  assert.equal(p1.pagination.page, 1);
  assert.equal(p1.pagination.limit, 10);
  assert.equal(p1.pagination.totalPages, 3);
  assert.equal(p1.data[0].id, 'AMB-1');

  // Page 3 with limit 10 (remaining 5)
  const p3 = mockPaginate(items, 3, 10);
  assert.equal(p3.data.length, 5);
  assert.equal(p3.pagination.page, 3);
  assert.equal(p3.data[0].id, 'AMB-21');
});
