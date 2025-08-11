import { useEffect, useState } from "react";
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import GroupReplies from "./GroupReplies";

export default function GroupComments({ postId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!postId) return;
    const q = query(
      collection(db, "groupComments"),
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
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
      createdAt: serverTimestamp(),
    });

    setContent("");
  };

  return (
    <div className="mt-4">
      <form onSubmit={handleAddComment} className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 p-2 border rounded"
        />
        <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded">
          Post
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="border p-2 rounded">
            <strong>{comment.author}</strong>: {comment.content}
            <GroupReplies commentId={comment.id} currentUser={currentUser} />
          </div>
        ))}
      </div>
    </div>
  );
}
