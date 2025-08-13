import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import { formatDistanceToNow } from "date-fns";
import GroupReplies from "./GroupReplies";

export default function GroupComments({ postId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
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
        ...docSnap.data(),
      }));

      // Always ensure we have an avatar from users collection
      const updated = await Promise.all(
        docs.map(async (c) => {
          if (c.uid) {
            const userDoc = await getDoc(doc(db, "users", c.uid));
            if (userDoc.exists()) {
              return {
                ...c,
                authorPhotoURL:
                  userDoc.data().photoURL || DEFAULT_AVATAR,
              };
            }
          }
          return { ...c, authorPhotoURL: DEFAULT_AVATAR };
        })
      );

      setComments(updated);
    });

    return () => unsub();
  }, [postId, DEFAULT_AVATAR]);

  const canEditOrDeleteComment = (comment) => {
    if (!currentUser) return false;
    if (currentUser.isAdmin || currentUser.isModerator) return true;
    return comment.uid === currentUser.uid;
  };

  const formatCommentDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (err) {
      console.error("Error formatting date:", err);
      return "";
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    await addDoc(collection(db, "groupComments"), {
      postId,
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR,
      content: content.trim(),
      createdAt: serverTimestamp(),
    });
    setContent("");
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    await deleteDoc(doc(db, "groupComments", commentId));
  };

  const saveEditedComment = async () => {
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "groupComments", editingCommentId), {
      content: editContent.trim(),
      editedAt: serverTimestamp(),
    });
    setEditingCommentId(null);
    setEditContent("");
  };

  return (
    <div className="mt-4">
      {/* Add Comment Form */}
      <form
        onSubmit={handleAddComment}
        className="flex flex-wrap gap-2 mb-4"
      >
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 min-w-[200px] p-2 border rounded"
        />
        <button
          type="submit"
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Post
        </button>
      </form>

      {/* Comments List */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="border p-2 rounded flex flex-wrap sm:flex-nowrap items-start gap-2"
          >
            <img
              src={comment.authorPhotoURL || DEFAULT_AVATAR}
              alt={comment.author}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 break-words">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <strong>{comment.author}</strong>
                {comment.createdAt && (
                  <span className="text-xs text-gray-500">
                    {formatCommentDate(comment.createdAt)}
                  </span>
                )}
              </div>
              
              {editingCommentId === comment.id ? (
                <>
                  <textarea
                    className="w-full p-2 border rounded my-1"
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="space-x-2">
                    <button
                      onClick={saveEditedComment}
                      className="text-green-600 hover:underline"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingCommentId(null);
                        setEditContent("");
                      }}
                      className="text-red-600 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p>{comment.content}</p>
              )}

              {canEditOrDeleteComment(comment) &&
                editingCommentId !== comment.id && (
                  <div className="space-x-2 text-sm mt-1">
                    <button
                      onClick={() => {
                        setEditingCommentId(comment.id);
                        setEditContent(comment.content);
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                )}

              <GroupReplies
                commentId={comment.id}
                currentUser={currentUser}
                isAdmin={currentUser?.isAdmin}
                isModerator={currentUser?.isModerator}
                DEFAULT_AVATAR={DEFAULT_AVATAR}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}