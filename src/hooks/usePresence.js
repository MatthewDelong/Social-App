import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const HEARTBEAT_MS = 25000;

export function usePresence() {
  useEffect(() => {
    let cleanup = () => {};
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const userDoc = doc(db, 'users', user.uid);

      const beat = async (online = true) => {
        try {
          await updateDoc(userDoc, { online, lastSeen: serverTimestamp() });
        } catch {
          await setDoc(userDoc, { online, lastSeen: serverTimestamp() }, { merge: true });
        }
      };

      beat(true);
      const interval = setInterval(() => beat(true), HEARTBEAT_MS);

      const onVisibility = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') beat(true);
      };

      const goOffline = () => {
        updateDoc(userDoc, { online: false, lastSeen: serverTimestamp() }).catch(() => {});
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', goOffline);
        window.addEventListener('beforeunload', goOffline);
      }

      cleanup = () => {
        clearInterval(interval);
        if (typeof window !== 'undefined') {
          window.removeEventListener('visibilitychange', onVisibility);
          window.removeEventListener('pagehide', goOffline);
          window.removeEventListener('beforeunload', goOffline);
        }
        goOffline();
      };
    });

    return () => {
      cleanup();
      unsubAuth();
    };
  }, []);
}