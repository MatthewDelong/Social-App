// src/context/AppContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingTheme, setLoadingTheme] = useState(true);

  const defaultTheme = { navbarColor: '#ffffff', backgroundColor: '#f9fafb' };
  const [theme, setTheme] = useState(defaultTheme);

  const saveTheme = async (newTheme) => {
    try {
      setTheme(newTheme);
      document.body.style.backgroundColor = newTheme.backgroundColor;
      await setDoc(doc(db, 'settings', 'theme'), newTheme);
    } catch (err) {
      console.error('Error saving theme:', err);
    }
  };

  useEffect(() => {
    const themeRef = doc(db, 'settings', 'theme');
    (async () => {
      try {
        const snap = await getDoc(themeRef);
        const t = snap.exists() ? snap.data() : defaultTheme;
        setTheme(t);
        document.body.style.backgroundColor = t.backgroundColor;
      } catch {
        setTheme(defaultTheme);
        document.body.style.backgroundColor = defaultTheme.backgroundColor;
      } finally {
        setLoadingTheme(false);
      }
    })();
    const unsub = onSnapshot(themeRef, (snap) => {
      if (snap.exists()) {
        const t = snap.data();
        setTheme(t);
        document.body.style.backgroundColor = t.backgroundColor;
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let unsubProfile = null;
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setLoadingUser(true);
      if (!currentUser) {
        if (unsubProfile) unsubProfile();
        setUser(null);
        setLoadingUser(false);
        return;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(
            userRef,
            {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
            },
            { merge: true }
          );
        }
      } catch {}

      if (unsubProfile) unsubProfile();
      unsubProfile = onSnapshot(userRef, (s) => {
        const data = s.data() || {};
        const isAdmin = !!data.isAdmin;
        const isModerator = !!data.isModerator;
        setUser({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: data.displayName ?? currentUser.displayName ?? currentUser.email ?? '',
          photoURL: data.photoURL ?? currentUser.photoURL ?? '',
          bannerURL: data.bannerURL ?? '',
          isAdmin,
          isModerator,
          role: isAdmin ? 'admin' : isModerator ? 'moderator' : 'user',
        });
        setLoadingUser(false);
      });
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubAuth();
    };
  }, []);

  const logout = () => signOut(auth);

  return (
    <AppContext.Provider
      value={{
        user,
        logout,
        loading: loadingUser || loadingTheme,
        theme,
        saveTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);