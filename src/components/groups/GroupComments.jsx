import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import GroupReplies from "./GroupReplies";

export default function GroupComments({ postId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [editId, setEditId] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    const loadDefaultAvatar = async () => {
      try {
        const defaultRef = ref(storage, "default-avatar.png");
        const url = await getDownloadURL(defaultRef);
        setDEFAULT_AVATAR(url);
      } catch (err) {
        console.error("Error loading default avatar:", err);
      }
    };
    loadDefaultAvatar();
  }, []);

  useEffect(() => {
    if (!postId) return;
    const q = query(
      collection(db, "groupComments"),
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      // 🔹 Fetch missing avatars from users/{uid}
      const updated = await Promise.all(
        docs.map(async (c) => {
          if (!c.authorPhotoURL && c.uid) {
            const userDoc = await getDoc(doc(db, "users", c.uid));
            if (userDoc.exists()) {
              return { ...c, authorPhotoURL: userDoc.data().photoURL || "" };
            }
          }
          return c;
        })
      );

      setComments(updated);
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

  const handleStartEdit = (comment) => {
    setEditId(comment.id);
    setEditContent(comment.content || "");
  };

  const handleCancelEdit = () => {
    setEditId("");
    setEditContent("");
  };

  const handleSaveEdit = async (commentId) => {
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "groupComments", commentId), {
      content: editContent.trim(),
    });
    setEditId("");
    setEditContent("");
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    await deleteDoc(doc(db, "groupComments", commentId));
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
        <button
          type="submit"
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Post
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="border p-2 rounded flex items-start gap-2">
            <img
              src={comment.authorPhotoURL || DEFAULT_AVATAR}
              alt={comment.author}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <strong>{comment.author}</strong>:
                  {editId === comment.id ? (
                    <div className="mt-1 flex gap-2">
                      <input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="flex-1 p-1 border rounded text-sm"
                      />
                    </div>
                  ) : (
                    <span> {comment.content}</span>
                  )}
                </div>
                {comment.uid === currentUser.uid && (
                  <div className="ml-2 flex items-center gap-2">
                    {editId === comment.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(comment.id)}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-2 py-1 bg-gray-300 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(comment)}
                          className="text-blue-500 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-500 text-sm"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <GroupReplies commentId={comment.id} currentUser={currentUser} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}