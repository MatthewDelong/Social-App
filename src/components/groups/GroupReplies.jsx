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
  deleteDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref } from "firebase/storage";

export default function GroupReplies({
  commentId,
  parentReplyId = null,  // new prop for nested replies, default null
  currentUser,
  isAdmin,
  isModerator,
}) {
  const [replies, setReplies] = useState([]);
  const [content, setContent] = useState("");
  const [editReplyId, setEditReplyId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");

  // Load default avatar once
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

  // Fetch replies filtered by commentId and parentReplyId
  useEffect(() => {
    if (!commentId) return;

    const q = query(
      collection(db, "groupReplies"),
      where("commentId", "==", commentId),
      where("parentReplyId", "==", parentReplyId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const updated = await Promise.all(
        docs.map(async (reply) => {
          if (!reply.authorPhotoURL && reply.uid) {
            try {
              const userDoc = await getDoc(doc(db, "users", reply.uid));
              if (userDoc.exists()) {
                return { ...reply, authorPhotoURL: userDoc.data().photoURL || "" };
              }
            } catch (err) {
              console.error("Error fetching user photoURL:", err);
            }
          }
          return reply;
        })
      );

      setReplies(updated);
    });

    return () => unsub();
  }, [commentId, parentReplyId]);

  const handleAddReply = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    await addDoc(collection(db, "groupReplies"), {
      commentId,
      parentReplyId,  // save parentReplyId (null for top-level)
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || "",
      content: content.trim(),
      createdAt: serverTimestamp(),
    });

    setContent("");
  };

  const handleDeleteReply = async (replyId) => {
    if (!window.confirm("Are you sure you want to delete this reply?")) return;
    await deleteDoc(doc(db, "groupReplies", replyId));
  };

  const handleEditReply = (reply) => {
    setEditReplyId(reply.id);
    setEditContent(reply.content);
  };

  const handleUpdateReply = async (e) => {
    e.preventDefault();
    if (!editContent.trim()) return;

    await updateDoc(doc(db, "groupReplies", editReplyId), {
      content: editContent.trim(),
      editedAt: serverTimestamp(),
    });

    setEditReplyId(null);
    setEditContent("");
  };

  const handleCancelEdit = () => {
    setEditReplyId(null);
    setEditContent("");
  };

  const canEditOrDelete = (reply) => {
    if (!currentUser) return false;
    const isOwner = reply.uid === currentUser.uid;
    return isOwner || isAdmin || isModerator;
  };

  return (
    <div className={parentReplyId ? "ml-6 mt-2" : "mt-2 ml-6"}>
      <form onSubmit={handleAddReply} className="flex gap-2 mb-1">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a reply..."
          className="flex-1 p-1 border rounded text-sm"
        />
        <button
          type="submit"
          className="px-2 py-1 bg-gray-500 text-white rounded text-sm"
        >
          Reply
        </button>
      </form>

      <div className="space-y-1">
        {replies.map((reply) => (
          <div
            key={reply.id}
            className="border p-1 rounded text-sm flex items-center gap-2"
          >
            <img
              src={reply.authorPhotoURL || DEFAULT_AVATAR}
              alt={reply.author}
              className="w-6 h-6 rounded-full object-cover"
            />
            <div className="flex-1">
              <strong>{reply.author}</strong>:{" "}
              {editReplyId === reply.id ? (
                <form
                  onSubmit={handleUpdateReply}
                  className="inline-flex gap-2 items-center"
                >
                  <input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="p-1 border rounded text-sm"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-2 py-1 bg-gray-400 text-white rounded text-xs"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                reply.content
              )}

              {canEditOrDelete(reply) && editReplyId !== reply.id && (
                <span className="ml-2 space-x-2 text-xs text-gray-600">
                  <button
                    onClick={() => handleEditReply(reply)}
                    className="text-blue-500 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteReply(reply.id)}
                    className="text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </span>
              )}

              {/* Recursive nested replies */}
              <GroupReplies
                commentId={commentId}
                parentReplyId={reply.id}
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