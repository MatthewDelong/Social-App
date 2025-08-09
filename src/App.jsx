import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingTheme, setLoadingTheme] = useState(true);

  const defaultTheme = {
    navbarColor: '#ffffff',
    backgroundColor: '#f9fafb'
  };

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

  // Theme loading
  useEffect(() => {
    const themeRef = doc(db, 'settings', 'theme');

    (async () => {
      try {
        const docSnap = await getDoc(themeRef);
        if (docSnap.exists()) {
          const newTheme = docSnap.data();
          setTheme(newTheme);
          document.body.style.backgroundColor = newTheme.backgroundColor;
        } else {
          setTheme(defaultTheme);
          document.body.style.backgroundColor = defaultTheme.backgroundColor;
        }
      } catch (err) {
        console.error('Error loading theme:', err);
        setTheme(defaultTheme);
        document.body.style.backgroundColor = defaultTheme.backgroundColor;
      } finally {
        setLoadingTheme(false);
      }
    })();

    const unsubTheme = onSnapshot(themeRef, (snapshot) => {
      if (snapshot.exists()) {
        const newTheme = snapshot.data();
        setTheme(newTheme);
        document.body.style.backgroundColor = newTheme.backgroundColor;
      }
    });

    return () => unsubTheme();
  }, []);

  // Auth loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Default displayName if missing
        if (!currentUser.displayName) {
          await updateProfile(currentUser, { displayName: 'Matthew Delong' });
          await currentUser.reload();
        }

        let isAdmin = false;
        let isModerator = false;

        try {
          const docSnap = await getDoc(doc(db, 'users', currentUser.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            isAdmin = data.isAdmin || false;
            isModerator = data.isModerator || false;
          }
        } catch (e) {
          console.error('Error loading user roles:', e);
        }

        setUser({
          ...auth.currentUser,
          isAdmin,
          isModerator,
          role: isAdmin ? 'admin' : isModerator ? 'moderator' : 'user'
        });
      } else {
        setUser(null);
      }

      // ✅ Now set loadingUser to false AFTER all role fetch is done
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = () => signOut(auth);

  return (
    <AppContext.Provider
      value={{
        user,
        logout,
        loading: loadingUser || loadingTheme, // ✅ stays true until both are done
        theme,
        saveTheme
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);