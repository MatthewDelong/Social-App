import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

const rid = (a, b) => `${a}_${b}`;

export function useFriendship(currentUid, targetUid) {
  const [friends, setFriends] = useState(false);
  const [outgoing, setOutgoing] = useState(false);
  const [incoming, setIncoming] = useState(false);

  useEffect(() => {
    if (!currentUid || !targetUid || currentUid === targetUid) return;
    const u1 = onSnapshot(doc(db, "users", currentUid, "friends", targetUid), (s) => setFriends(s.exists()));
    const u2 = onSnapshot(doc(db, "friendRequests", rid(currentUid, targetUid)), (s) => setOutgoing(s.exists()));
    const u3 = onSnapshot(doc(db, "friendRequests", rid(targetUid, currentUid)), (s) => setIncoming(s.exists()));
    return () => {
      u1 && u1();
      u2 && u2();
      u3 && u3();
    };
  }, [currentUid, targetUid]);

  const state = useMemo(() => {
    if (!currentUid || currentUid === targetUid) return "self";
    if (friends) return "friends";
    if (incoming) return "incoming";
    if (outgoing) return "outgoing";
    return "none";
  }, [currentUid, targetUid, friends, incoming, outgoing]);

  return { state };
}
