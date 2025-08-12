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
  deleteDoc,
  updateDoc,
  getDocs
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import GroupReplies from "./GroupReplies";

export default function GroupComments({ postId, currentUser, isAdmin, isModerator }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

  // Editing state
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editedContent, setEditedContent] = useState("");

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

      // Fetch missing avatars from users/{uid}
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

  // Delete comment and its replies
  const handleDeleteComment = async (commentId) => {
    await deleteDoc(doc(db, "groupComments", commentId));

    const repliesQuery = query(collection(db, "groupReplies"), where("commentId", "==", commentId));
    const repliesSnapshot = await getDocs(repliesQuery);
    const batchDeletes = repliesSnapshot.docs.map((docSnap) => deleteDoc(doc(db, "groupReplies", docSnap.id)));
    await Promise.all(batchDeletes);
  };

  // Edit handlers
  const startEditingComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditedContent(comment.content);
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditedContent("");
  };

  const saveEditedComment = async () => {
    if (!editedContent.trim()) return;
    await updateDoc(doc(db, "groupComments", editingCommentId), {
      content: editedContent.trim(),
    });
    setEditingCommentId(null);
    setEditedContent("");
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
              <strong>{comment.author}</strong>:{" "}
              {editingCommentId === comment.id ? (
                <>
                  <input
                    type="text"
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="border rounded p-1 text-sm w-full"
                  />
                  <div className="space-x-2 mt-1">
                    <button onClick={saveEditedComment} className="text-green-600 text-sm">Save</button>
                    <button onClick={cancelEditingComment} className="text-red-600 text-sm">Cancel</button>
                  </div>
                </>
              ) : (
                comment.content
              )}

              {(currentUser.uid === comment.uid || isAdmin || isModerator) && editingCommentId !== comment.id && (
                <div className="mt-1 space-x-2 text-xs text-gray-600">
                  <button onClick={() => startEditingComment(comment)}>Edit</button>
                  <button onClick={() => handleDeleteComment(comment.id)}>Delete</button>
                </div>
              )}

              <GroupReplies
                commentId={comment.id}
                currentUser={currentUser}
                isAdmin={isAdmin}
                isModerator={isModerator}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}