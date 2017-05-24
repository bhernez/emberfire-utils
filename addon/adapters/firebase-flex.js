/** @module emberfire-utils */
import { pluralize } from 'ember-inflector';
import { assign } from 'ember-platform';
import { bind } from 'ember-runloop';
import Adapter from 'ember-data/adapter';
import RSVP from 'rsvp';
import inject from 'ember-service/inject';

/**
 * @class FirebaseFlex
 * @namespace Adapter
 * @extends DS.Adapter
 */
export default Adapter.extend({
  defaultSerializer: '-firebase-flex',

  /**
   * @type {Ember.Service}
   * @default
   * @readonly
   */
  firebase: inject(),

  /**
   * @type {Object}
   * @default
   */
  trackedListeners: {},

  /**
   * @return {string} Push ID
   */
  generateIdForRecord() {
    return this.get('firebase').push().key;
  },

  /**
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {DS.Snapshot} snapshot
   * @return {Promise} Resolves when create record succeeds
   */
  createRecord(store, type, snapshot) {
    return this.updateRecord(store, type, snapshot).then(() => {
      this._setupValueListener(store, type.modelName, snapshot.id);
    });
  },

  /**
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {DS.Snapshot} snapshot
   * @return {Promise} Resolves when update record succeeds
   */
  updateRecord(store, type, snapshot) {
    return new RSVP.Promise(bind(this, (resolve, reject) => {
      const serializedSnapshot = this.serialize(snapshot);
      const serializedInclude = this._serializeInclude(snapshot);
      const fanout = assign({}, serializedSnapshot, serializedInclude);

      this.get('firebase').update(fanout, bind(this, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }));
    }));
  },

  /**
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {string} id
   * @return {Promise} Resolves with the fetched record
   */
  findRecord(store, type, id) {
    return new RSVP.Promise(bind(this, (resolve, reject) => {
      const modelName = type.modelName;
      const ref = this._getFirebaseReference(modelName, id);
      const onValue = bind(this, (snapshot) => {
        if (snapshot.exists()) {
          this._setupValueListener(store, modelName, id);
          ref.off('value', onValue);
          resolve(this._getGetSnapshotWithId(snapshot));
        } else {
          reject();
        }
      });

      ref.on('value', onValue);
    }));
  },

  /**
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @return {Promise} Resolves with the fetched records
   */
  findAll(store, type) {
    return new RSVP.Promise(bind(this, (resolve, reject) => {
      const modelName = type.modelName;
      const ref = this._getFirebaseReference(modelName);

      ref.on('value', bind(this, (snapshot) => {
        if (snapshot.exists()) {
          const records = [];

          snapshot.forEach((child) => {
            this._setupValueListener(store, modelName, child.key);
            records.push(this._getGetSnapshotWithId(child));
          });

          this._setupListListener(store, modelName);
          ref.off('value');
          resolve(records);
        } else {
          reject();
        }
      }), bind(this, (error) => {
        reject(error);
      }));
    }));
  },

  /**
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {DS.Snapshot} snapshot
   * @return {Promise} Resolves once the record has been deleted
   */
  deleteRecord(store, type, snapshot) {
    return new RSVP.Promise(bind(this, (resolve, reject) => {
      const modelName = type.modelName;
      const id = snapshot.id;
      const path = `/${pluralize(modelName)}/${id}`;
      const serializedInclude = this._serializeInclude(snapshot);
      let fanout = {};

      fanout[path] = null;
      fanout = assign({}, fanout, serializedInclude);

      this.get('firebase').update(fanout, bind(this, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }));
    }));
  },

  /**
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {Object} [query={}]
   * @return {Promise} Resolves with the queried record
   */
  queryRecord(store, type, query = {}) {
    return new RSVP.Promise(bind(this, (resolve, reject) => {
      if (!query.hasOwnProperty('firebase')) {
        query.firebase = {};
      }

      if (query.firebase.hasOwnProperty('path')) {
        this._queryRecordWithPath(store, type, query).then((record) => {
          resolve(record);
        }).catch((error) => {
          reject(error);
        });
      } else {
        this._queryRecordWithoutPath(store, type, query).then((record) => {
          resolve(record);
        }).catch((error) => {
          reject(error);
        });
      }
    }));
  },

  /**
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {Object} query
   * @return {Promise} Resolves with the queried record
   */
  _queryRecordWithPath(store, type, query) {
    return new RSVP.Promise(bind(this, (resolve, reject) => {
      let ref = this.get('firebase').child(query.firebase.path);

      ref = this._setupQuerySortingAndFiltering(ref, query.firebase, true);

      ref.once('value').then(bind(this, (snapshot) => {
        if (snapshot.exists()) {
          // Will always loop once because of the forced limitTo* 1
          snapshot.forEach((child) => {
            this.findRecord(store, type, child.key).then((record) => {
              resolve(record);
            }).catch((error) => {
              reject(error);
            });
          });
        } else {
          resolve();
        }
      }), bind(this, (error) => {
        reject(error);
      }));
    }));
  },

  /**
   * @param {DS.Store} store
   * @param {DS.Model} type
   * @param {Object} query
   * @return {Promise} Resolves with the queried record
   */
  _queryRecordWithoutPath(store, type, query) {
    return new RSVP.Promise(bind(this, (resolve, reject) => {
      const modelName = type.modelName;
      const onValue = bind(this, (snapshot) => {
        let record;

        if (snapshot.exists()) {
          // Will always loop once because of the forced limitTo* 1
          snapshot.forEach((child) => {
            this._setupValueListener(store, modelName, child.key);
            record = this._getGetSnapshotWithId(child);
          });

          ref.off('value', onValue);
          resolve(record);
        } else {
          resolve(record);
        }
      });
      let ref = this._getFirebaseReference(modelName);

      ref = this._setupQuerySortingAndFiltering(ref, query.firebase, true);

      ref.on('value', onValue, bind(this, (error) => {
        reject(error);
      }));
    }));
  },

  /**
   * @param {DS.Snapshot} snapshot
   * @return {Object} Serialized include
   * @private
   */
  _serializeInclude(snapshot) {
    let newInclude = {};

    if (snapshot.hasOwnProperty('firebase')) {
      const include = snapshot.firebase.include;

      for (let key in include) {
        if (Object.prototype.hasOwnProperty.call(include, key)) {
          const newKey = key.replace('$id', snapshot.id);

          newInclude[newKey] = include[key];
        }
      }
    }

    return newInclude;
  },

  /**
   * @param {DS.Store} store
   * @param {string} modelName
   * @param {string} id
   * @private
   */
  _setupValueListener(store, modelName, id) {
    const path = `/${pluralize(modelName)}/${id}`;

    if (!this._isListenerTracked(path, 'value')) {
      this._trackListener(path, 'value');

      const ref = this._getFirebaseReference(modelName, id);

      ref.on('value', bind(this, (snapshot) => {
        if (snapshot.exists()) {
          const snapshotWithId = this._getGetSnapshotWithId(snapshot);
          const normalizedRecord = store.normalize(modelName, snapshotWithId);

          store.push(normalizedRecord);
        } else {
          this._unloadRecord(store, modelName, id);
        }
      }), bind(this, (error) => {
        this._unloadRecord(store, modelName, id);
      }));
    }
  },

  /**
   * @param {DS.Store} store
   * @param {string} modelName
   * @private
   */
  _setupListListener(store, modelName) {
    const path = `/${pluralize(modelName)}`;

    if (!this._isListenerTracked(path, 'child_added')) {
      this._trackListener(path, 'child_added');
      this._getFirebaseReference(modelName).on('child_added', (snapshot) => {
        this._setupValueListener(store, modelName, snapshot.key);
      });
    }
  },

  /**
   * @param {firebase.database.DataSnapshot} ref
   * @param {Object} query
   * @param {boolean} isForcingLimitToOne
   * @return {firebase.database.DataSnapshot} Reference with sort/filters
   * @private
   */
  _setupQuerySortingAndFiltering(ref, query, isForcingLimitToOne) {
    if (!query.hasOwnProperty('orderBy')) {
      query.orderBy = 'id';
    }

    if (query.orderBy === 'id') {
      ref = ref.orderByKey();
    } else if (query.orderBy === '.value') {
      ref = ref.orderByValue();
    } else {
      ref = ref.orderByChild(query.orderBy);
    }

    if (isForcingLimitToOne) {
      if (query.hasOwnProperty('limitToFirst') ||
          query.hasOwnProperty('limitToLast')) {
        if (query.hasOwnProperty('limitToFirst')) {
          query.limitToFirst = 1;
        } else {
          query.limitToLast = 1;
        }
      } else {
        query.limitToFirst = 1;
      }
    }

    [
      'startAt',
      'endAt',
      'equalTo',
      'limitToFirst',
      'limitToLast',
    ].forEach((type) => {
      if (query.hasOwnProperty(type)) {
        ref = ref[type](query[type]);
      }
    });

    return ref;
  },

  /**
   * @param {firebase.database.DataSnapshot} snapshot
   * @return {Object} Snapshot with ID
   * @private
   */
  _getGetSnapshotWithId(snapshot) {
    return assign({}, { id: snapshot.key }, snapshot.val());
  },

  /**
   * @param {string} modelName
   * @param {string} [id='']
   * @return {firebase.database.DataSnapshot} Firebase reference
   * @private
   */
  _getFirebaseReference(modelName, id = '') {
    const path = `/${pluralize(modelName)}/${id}`;

    return this.get('firebase').child(path);
  },

  /**
   * @param {DS.Store} store
   * @param {string} modelName
   * @param {string} id
   * @private
   */
  _unloadRecord(store, modelName, id) {
    const record = store.peekRecord(modelName, id);

    if (record && !record.isSaving) {
      store.unloadRecord(record);
    }
  },

  /**
   * @param {string} key trackedListeners key
   * @param {string} type Type of listener (value, child_added, etc.)
   * @return {boolean} True if already tracked. Otherwise, false.
   * @private
   */
  _isListenerTracked(key, type) {
    const trackedListeners = this.get('trackedListeners');

    return trackedListeners.hasOwnProperty(key) && trackedListeners[key][type];
  },

  /**
   * @param {string} key trackedListeners key
   * @param {string} type Type of listener (value, child_added, etc.)
   * @private
   */
  _trackListener(key, type) {
    const trackedListeners = this.get('trackedListeners');
    const tempTrackedListeners = assign({}, trackedListeners);

    if (!tempTrackedListeners.hasOwnProperty(key)) {
      tempTrackedListeners[key] = {};
    }

    tempTrackedListeners[key][type] = true;

    this.set('trackedListeners', assign(
        {}, trackedListeners, tempTrackedListeners));
  },
});
