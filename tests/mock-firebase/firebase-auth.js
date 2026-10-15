import { auth, seed, publish } from './state.js';
export const browserLocalPersistence = 'local';
export const inMemoryPersistence = 'memory';
export function getAuth() { return auth; }
export async function setPersistence() {}
export function onAuthStateChanged(instance, listener) {
  instance.listener = listener;
  queueMicrotask(() => listener(instance.currentUser));
  return () => { instance.listener = null; };
}
export async function validatePassword(instance, password) { return { isValid: password.length >= 6 }; }
export async function signInWithEmailAndPassword(instance, email, password) {
  if (password === 'wrong-password') throw { code: 'auth/invalid-credential' };
  const user = { uid: email.toLowerCase(), email };
  seed(user.uid); instance.currentUser = user; instance.listener?.(user); publish(user.uid);
  return { user };
}
export const createUserWithEmailAndPassword = signInWithEmailAndPassword;
export async function signOut(instance) {
  instance.currentUser = null; instance.listener?.(null);
}
