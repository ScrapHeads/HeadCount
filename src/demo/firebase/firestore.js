import {
  DemoTimestamp,
  addDemoDoc,
  collectionRef,
  createDemoBatch,
  demoServerTimestamp,
  documentRef,
  getDemoDoc,
  getDemoDocs,
  getDemoFirestore,
  limitConstraint,
  onDemoSnapshot,
  orderByConstraint,
  queryRef,
  runDemoTransaction,
  updateDemoDoc,
  whereConstraint,
} from './backend';

export const Timestamp = DemoTimestamp;

export const getFirestore = (app) => getDemoFirestore(app);

export const collection = (db, collectionName) => collectionRef(db, collectionName);

export const doc = (...args) => documentRef(...args);

export const query = (source, ...constraints) => queryRef(source, ...constraints);

export const where = (field, operator, value) => whereConstraint(field, operator, value);

export const orderBy = (field, direction) => orderByConstraint(field, direction);

export const limit = (count) => limitConstraint(count);

export const getDocs = (target) => getDemoDocs(target);

export const getDoc = (ref) => getDemoDoc(ref);

export const addDoc = (collectionReference, data) => addDemoDoc(collectionReference, data);

export const updateDoc = (documentReference, data) => updateDemoDoc(documentReference, data);

export const onSnapshot = (target, onData, onError) => onDemoSnapshot(target, onData, onError);

export const writeBatch = () => createDemoBatch();

export const runTransaction = (db, callback) => runDemoTransaction(db, callback);

export const serverTimestamp = () => demoServerTimestamp();
