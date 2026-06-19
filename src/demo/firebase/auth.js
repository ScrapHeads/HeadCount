import {
  createDemoAuthUser,
  deleteDemoAuthUser,
  getDemoAuth,
  onDemoAuthStateChanged,
  signInDemoUser,
  signOutDemoUser,
} from './backend';

export const getAuth = (app) => getDemoAuth(app);

export const onAuthStateChanged = (auth, callback) => onDemoAuthStateChanged(auth, callback);

export const signInWithEmailAndPassword = (auth, email, password) => (
  signInDemoUser(auth, email, password)
);

export const createUserWithEmailAndPassword = (auth, email, password) => (
  createDemoAuthUser(auth, email, password)
);

export const deleteUser = (user) => deleteDemoAuthUser(user);

export const signOut = (auth) => signOutDemoUser(auth);
