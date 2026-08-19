import { authApi } from "./api";
import type { User } from "@/types/auth";

let _user: User | null = null;
let _isInitialized = false;
let _initPromise: Promise<User | null> | null = null;

export const authSession = {
  getUser(): User | null {
    return _user;
  },

  isAuthenticated(): boolean {
    return _user !== null;
  },

  isInitialized(): boolean {
    return _isInitialized;
  },

  set(user: User | null): void {
    _user = user;
    _isInitialized = true;
    _initPromise = Promise.resolve(user);
  },

  clear(): void {
    _user = null;
    _isInitialized = true;
    _initPromise = Promise.resolve(null);
  },

  async ensureInitialized(): Promise<User | null> {
    if (_isInitialized) {
      return _user;
    }

    if (_initPromise) {
      return _initPromise;
    }

    _initPromise = (async () => {
      try {
        const currentUser = await authApi.me();
        _user = currentUser;
        return currentUser;
      } catch {
        _user = null;
        return null;
      } finally {
        _isInitialized = true;
      }
    })();

    return _initPromise;
  },
};
