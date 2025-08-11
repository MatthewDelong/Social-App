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
import GroupReplies from "./GroupReplies";

export default function GroupComments({ postId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "groupComments"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setComments(
        snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((c) => c.postId === postId)
      );
    });

    return unsub;
  }, [postId]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    await addDoc(collection(db, "groupComments"), {
      postId,
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || "",
      content: content.trim(),
      createdAt: serverTimestamp()
    });

    setContent("");
  };

  return (
    <div style={{ marginTop: 16 }}>
      <form onSubmit={handleAddComment}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
        />
        <button type="submit">Post</button>
      </form>

      <div style={{ marginTop: 8 }}>
        {comments.map((comment) => (
          <div key={comment.id} style={{ marginBottom: 8 }}>
            <strong>{comment.author}</strong>: {comment.content}
            <GroupReplies commentId={comment.id} currentUser={currentUser} />
          </div>
        ))}
      </div>
    </div>
  );
}
