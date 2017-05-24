import { moduleFor, test } from 'ember-qunit';

import createOfflineRef from 'dummy/tests/helpers/create-offline-ref';
import destroyFirebaseApps from 'dummy/tests/helpers/destroy-firebase-apps';
import sinon from 'sinon';
import stubFirebase from 'dummy/tests/helpers/stub-firebase';
import unStubFirebase from 'dummy/tests/helpers/unstub-firebase';

import getFixtureData from 'dummy/tests/helpers/fixture-data';

moduleFor('adapter:firebase-flex', 'Unit | Adapter | firebase flex', {
  needs: [ 'service:firebase' ],

  beforeEach() {
    stubFirebase();
    this.ref = createOfflineRef(getFixtureData());
  },

  afterEach() {
    unStubFirebase();
    destroyFirebaseApps();
  },
});

test('should generate ID for record', function(assert) {
  assert.expect(1);

  // Arrange
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = adapter.generateIdForRecord();

  // Assert
  assert.ok(result);
});

test('should update Firebase when creating a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const serializedSnapshot = {
    '/posts/post_c/message': 'Message',
    '/posts/post_c/timestamp': 12345,
  };
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const spy = sinon.spy(this.ref, 'update');
  const adapter = this.subject({
    firebase: this.ref,
    serialize: sinon.stub().returns(serializedSnapshot),
  });

  // Act
  await adapter.updateRecord(store, { modelName: 'post' }, {
    id: 'post_c',
    message: 'Message',
    timestamp: 12345,
    firebase: {
      include: {
        '/userFeeds/user_a/post_c': true,
        '/userFeeds/user_b/post_c': true,
      },
    },
  });

  // Assert
  assert.ok(spy.calledWith({
    '/posts/post_c/message': 'Message',
    '/posts/post_c/timestamp': 12345,
    '/userFeeds/user_a/post_c': true,
    '/userFeeds/user_b/post_c': true,
  }));
});

test('should push realtime changes to store after creating a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const serializedSnapshot = {
    '/posts/post_c/message': 'Message',
    '/posts/post_c/timestamp': 12345,
  };
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
    serialize: sinon.stub().returns(serializedSnapshot),
  });

  // Act
  await adapter.createRecord(store, { modelName: 'post' }, {
    id: 'post_c',
    message: 'Message',
    timestamp: 12345,
  });

  // Assert
  assert.ok(stub.calledWithExactly('foo'));
});

test('should track Firebase listeners when creating a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const serializedSnapshot = {
    '/posts/post_c/message': 'Message',
    '/posts/post_c/timestamp': 12345,
  };
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const adapter = this.subject({
    firebase: this.ref,
    serialize: sinon.stub().returns(serializedSnapshot),
  });

  // Act
  await adapter.createRecord(store, { modelName: 'post' }, {
    id: 'post_c',
    message: 'Message',
    timestamp: 12345,
  });
  const result = adapter.get('trackedListeners');

  // Assert
  assert.deepEqual(result, { '/posts/post_c': { value: true } });
});

test('should not duplicate pushing realtime changes to store after creating a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const serializedSnapshot = {
    '/posts/post_c/message': 'Message',
    '/posts/post_c/timestamp': 12345,
  };
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
    trackedListeners: { '/posts/post_c': { value: true } },
    serialize: sinon.stub().returns(serializedSnapshot),
  });

  // Act
  await adapter.createRecord(store, { modelName: 'post' }, {
    id: 'post_c',
    message: 'Message',
    timestamp: 12345,
  });

  // Assert
  assert.ok(stub.notCalled);
});

test('should unload record when it gets deleted from the backend after creating a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const serializedSnapshot = {
    '/posts/post_c/message': 'Message',
    '/posts/post_c/timestamp': 12345,
  };
  const stub = sinon.stub();
  const store = {
    normalize: sinon.stub().returns('foo'),
    peekRecord: sinon.stub().returns('foo'),
    push: sinon.stub(),
    unloadRecord: stub,
  };
  const adapter = this.subject({
    firebase: this.ref,
    serialize: sinon.stub().returns(serializedSnapshot),
  });

  // Act
  await adapter.createRecord(store, { modelName: 'post' }, {
    id: 'post_c',
    message: 'Message',
    timestamp: 12345,
  });
  await this.ref.child('/posts/post_c').remove();

  // Assert
  assert.ok(stub.calledWithExactly('foo'));
});

test('should update Firebase when updating a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const serializedSnapshot = {
    '/posts/post_a/message': 'Message',
    '/posts/post_a/timestamp': 12345,
  };
  const spy = sinon.spy(this.ref, 'update');
  const adapter = this.subject({
    firebase: this.ref,
    serialize: sinon.stub().returns(serializedSnapshot),
  });

  // Act
  await adapter.updateRecord(null, null, {
    id: 'post_a',
    message: 'Message',
    timestamp: 12345,
    firebase: {
      include: {
        '/userFeeds/user_a/post_a': true,
        '/userFeeds/user_b/post_a': true,
      },
    },
  });

  // Assert
  assert.ok(spy.calledWith({
    '/posts/post_a/message': 'Message',
    '/posts/post_a/timestamp': 12345,
    '/userFeeds/user_a/post_a': true,
    '/userFeeds/user_b/post_a': true,
  }));
});

test('should return record when finding a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = await adapter.findRecord(store, {
    modelName: 'post',
  }, 'post_a');

  // Arrange
  assert.deepEqual(result, {
    id: 'post_a',
    message: 'Post A',
    timestamp: 12345,
    author: 'user_a',
  });
});

test('should error when finding a record that does not exist', async function(assert) {
  assert.expect(1);

  // Arrange
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  try {
    await adapter.findRecord({}, { modelName: 'post' }, 'post_z');
  } catch(e) {
    // Assert
    assert.ok(true);
  }
});

test('should push realtime changes to store after finding a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.findRecord(store, {
    modelName: 'post',
  }, 'post_a');

  // Arrange
  assert.ok(stub.calledWithExactly('foo'));
});

test('should track Firebase listeners when finding record', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.findRecord(store, {
    modelName: 'post',
  }, 'post_a');
  const result = adapter.get('trackedListeners');

  // Arrange
  assert.deepEqual(result, { '/posts/post_a': { value: true } });
});

test('should not duplicate pushing realtime changes to store after finding a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
    trackedListeners: { '/posts/post_a': { value: true } },
  });

  // Act
  await adapter.findRecord(store, {
    modelName: 'post',
  }, 'post_a');

  // Arrange
  assert.ok(stub.notCalled);
});

test('should unload record when it gets deleted from the backend after finding record', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = {
    normalize: sinon.stub().returns('foo'),
    peekRecord: sinon.stub().returns('foo'),
    push: sinon.stub(),
    unloadRecord: stub,
  };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.findRecord(store, {
    modelName: 'post',
  }, 'post_a');
  await this.ref.child('/posts/post_a').remove();

  // Arrange
  assert.ok(stub.calledWithExactly('foo'));
});

test('should return all records for a model when finding all', async function(assert) {
  assert.expect(1);

  // Arrange
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = await adapter.findAll(store, { modelName: 'post' });

  // Arrange
  assert.deepEqual(result, [{
    id: 'post_a',
    message: 'Post A',
    timestamp: 12345,
    author: 'user_a',
  }, {
    id: 'post_b',
    message: 'Post B',
    timestamp: 12345,
    author: 'user_a',
  }]);
});

test('should error when finding all records for a model but nothing exists', async function(assert) {
  assert.expect(1);

  // Arrange
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  try {
    await adapter.findAll({}, { modelName: 'test' });
  } catch(e) {
    // Assert
    assert.ok(true);
  }
});

test('should push realtime changes to store when finding all records for a model', async function(assert) {
  assert.expect(2);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.findAll(store, { modelName: 'post' });

  // Arrange
  assert.ok(stub.calledTwice);
  assert.ok(stub.calledWithExactly('foo'));
});

test('should track Firebase listeners when finding all records for a model', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.findAll(store, { modelName: 'post' });
  const result = adapter.get('trackedListeners');

  // Arrange
  assert.deepEqual(result, {
    '/posts': { child_added: true },
    '/posts/post_a': { value: true },
    '/posts/post_b': { value: true },
  });
});

test('should not duplicate pushing realtime changes to store after finding all records for a model', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
    trackedListeners: {
      '/posts/post_a': { value: true },
      '/posts/post_b': { value: true },
    },
  });

  // Act
  await adapter.findAll(store, { modelName: 'post' });

  // Arrange
  assert.ok(stub.notCalled);
});

test('should unload record when it gets deleted from the backend after finding all records for a model', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = {
    normalize: sinon.stub().returns('foo'),
    peekRecord: sinon.stub().returns('foo'),
    push: sinon.stub(),
    unloadRecord: stub,
  };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.findAll(store, { modelName: 'post' });
  await this.ref.child('/posts/post_a').remove();

  // Arrange
  assert.ok(stub.calledWithExactly('foo'));
});

test('should push realtime child_added changes to store after finding all records for a model', async function(assert) {
  assert.expect(2);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.findAll(store, { modelName: 'post' });
  await this.ref.child('/posts/post_c').update({
    message: 'Post C',
    timestamp: 12345,
    author: 'user_a',
  });

  // Arrange
  assert.ok(stub.calledThrice);
  assert.ok(stub.calledWithExactly('foo'));
});

test('should remove record from Firebase when deleting a record', async function(assert) {
  assert.expect(1);

  // Arrange
  const spy = sinon.spy(this.ref, 'update');
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.deleteRecord({}, { modelName: 'post' }, {
    id: 'post_a',
    message: 'Post A',
    timestamp: 12345,
    author: 'user_a',
    firebase: {
      include: {
        '/users/user_a': null,
      },
    },
  });

  // Assert
  assert.ok(spy.calledWith({
    '/posts/post_a': null,
    '/users/user_a': null,
  }));
});

test('should return a single record when querying for just one with equalTo', async function(assert) {
  assert.expect(1);

  // Arrange
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = await adapter.queryRecord(store, { modelName: 'post' }, {
    firebase: {
      equalTo: 'post_a',
    },
  });

  // Assert
  assert.deepEqual(result, {
    id: 'post_a',
    message: 'Post A',
    timestamp: 12345,
    author: 'user_a',
  });
});

test('should return a single record when querying for just one with startAt', async function(assert) {
  assert.expect(1);

  // Arrange
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = await adapter.queryRecord(store, { modelName: 'post' }, {
    firebase: {
      startAt: 'post',
    },
  });

  // Assert
  assert.deepEqual(result, {
    id: 'post_a',
    message: 'Post A',
    timestamp: 12345,
    author: 'user_a',
  });
});

test('should return a single record when querying for just one with endAt', async function(assert) {
  assert.expect(1);

  // Arrange
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = await adapter.queryRecord(store, { modelName: 'post' }, {
    firebase: {
      endAt: 'post_a',
    },
  });

  // Assert
  assert.deepEqual(result, {
    id: 'post_a',
    message: 'Post A',
    timestamp: 12345,
    author: 'user_a',
  });
});

test('should return a single record when querying for just one even with limitToFirst > 1', async function(assert) {
  assert.expect(1);

  // Arrange
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = await adapter.queryRecord(store, { modelName: 'post' }, {
    firebase: {
      limitToFirst: 10,
    },
  });

  // Assert
  assert.deepEqual(result, {
    id: 'post_a',
    message: 'Post A',
    timestamp: 12345,
    author: 'user_a',
  });
});

test('should return a single record when querying for just one even with limitToFirst > 1', async function(assert) {
  assert.expect(1);

  // Arrange
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = await adapter.queryRecord(store, { modelName: 'post' }, {
    firebase: {
      limitToLast: 10,
    },
  });

  // Assert
  assert.deepEqual(result, {
    id: 'post_b',
    message: 'Post B',
    timestamp: 12345,
    author: 'user_a',
  });
});

test('should return a single record when querying for just one with a path', async function(assert) {
  assert.expect(1);

  // Arrange
  const store = { normalize: sinon.stub().returns('foo'), push: sinon.stub() };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = await adapter.queryRecord(store, { modelName: 'post' }, {
    firebase: {
      path: '/userFeeds/user_a',
    },
  });

  // Assert
  assert.deepEqual(result, {
    id: 'post_a',
    message: 'Post A',
    timestamp: 12345,
    author: 'user_a',
  });
});

test('should return nothing when query for just one record that does not exist', async function(assert) {
  assert.expect(1);

  // Arrange
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  const result = await adapter.queryRecord({}, { modelName: 'post' }, {
    firebase: {
      equalTo: 'foo',
    },
  });

  // Assert
  assert.deepEqual(result, undefined);
});

test('should push realtime changes to store after querying for just one record', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.queryRecord(store, { modelName: 'post' });

  // Arrange
  assert.ok(stub.calledWithExactly('foo'));
});

test('should track Firebase listeners when querying for just one record', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.queryRecord(store, { modelName: 'post' });
  const result = adapter.get('trackedListeners');

  // Arrange
  assert.deepEqual(result, { '/posts/post_a': { value: true } });
});

test('should not duplicate pushing realtime changes when querying for just one record', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = { normalize: sinon.stub().returns('foo'), push: stub };
  const adapter = this.subject({
    firebase: this.ref,
    trackedListeners: { '/posts/post_a': { value: true } },
  });

  // Act
  await adapter.queryRecord(store, { modelName: 'post' }, {});

  // Arrange
  assert.ok(stub.notCalled);
});

test('should unload record when it gets deleted from the backend after querying for just one record', async function(assert) {
  assert.expect(1);

  // Arrange
  const stub = sinon.stub();
  const store = {
    normalize: sinon.stub().returns('foo'),
    peekRecord: sinon.stub().returns('foo'),
    push: sinon.stub(),
    unloadRecord: stub,
  };
  const adapter = this.subject({
    firebase: this.ref,
  });

  // Act
  await adapter.queryRecord(store, { modelName: 'post' }, {});
  await this.ref.child('/posts/post_a').remove();

  // Arrange
  assert.ok(stub.calledWithExactly('foo'));
});
