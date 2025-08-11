import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../firebase";

export default function GroupReplies({ commentId, currentUser }) {
  const [replies, setReplies] = useState([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "groupReplies"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setReplies(
        snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((r) => r.commentId === commentId)
      );
    });

    return unsub;
  }, [commentId]);

  const handleAddReply = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    await addDoc(collection(db, "groupReplies"), {
      commentId,
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || "",
      content: content.trim(),
      createdAt: serverTimestamp()
    });

    setContent("");
  };

  return (
    <div style={{ marginLeft: 20, marginTop: 8 }}>
      <form onSubmit={handleAddReply}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a reply..."
        />
        <button type="submit">Reply</button>
      </form>

      <div style={{ marginTop: 4 }}>
        {replies.map((reply) => (
          <div key={reply.id}>
            <strong>{reply.author}</strong>: {reply.content}
          </div>
        ))}
      </div>
    </div>
  );
}
