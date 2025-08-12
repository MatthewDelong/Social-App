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
import { db } from "../../firebase";

export default function GroupReplies({
  commentId,
  parentReplyId = null,
  currentUser,
  isAdmin,
  isModerator,
  DEFAULT_AVATAR,
}) {
  const [replies, setReplies] = useState([]);
  const [content, setContent] = useState("");
  const [editReplyId, setEditReplyId] = useState(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    if (!commentId) return;

    const q = query(
      collection(db, "groupReplies"),
      where("commentId", "==", commentId),
      where("parentReplyId", "==", parentReplyId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Always get avatar from users collection
      const updated = await Promise.all(
        docs.map(async (reply) => {
          if (reply.uid) {
            const userDoc = await getDoc(doc(db, "users", reply.uid));
            if (userDoc.exists()) {
              return {
                ...reply,
                authorPhotoURL:
                  userDoc.data().photoURL || DEFAULT_AVATAR,
              };
            }
          }
          return { ...reply, authorPhotoURL: DEFAULT_AVATAR };
        })
      );

      setReplies(updated);
    });

    return () => unsub();
  }, [commentId, parentReplyId, DEFAULT_AVATAR]);

  const canEditOrDelete = (reply) => {
    if (!currentUser) return false;
    return (
      reply.uid === currentUser.uid ||
      isAdmin ||
      isModerator
    );
  };

  const handleAddReply = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    await addDoc(collection(db, "groupReplies"), {
      commentId,
      parentReplyId,
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR,
      content: content.trim(),
      createdAt: serverTimestamp(),
    });
    setContent("");
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

  return (
    <div className={parentReplyId ? "ml-6 mt-2" : "mt-2 ml-6"}>
      {/* Add Reply Form */}
      <form
        onSubmit={handleAddReply}
        className="flex flex-wrap gap-2 mb-1"
      >
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a reply..."
          className="flex-1 min-w-[150px] p-1 border rounded text-sm"
        />
        <button
          type="submit"
          className="px-2 py-1 bg-gray-500 text-white rounded text-sm"
        >
          Reply
        </button>
      </form>

      {/* Replies List */}
      <div className="space-y-1">
        {replies.map((reply) => (
          <div
            key={reply.id}
            className="border p-1 rounded text-sm flex flex-wrap sm:flex-nowrap items-start gap-2"
          >
            <img
              src={reply.authorPhotoURL || DEFAULT_AVATAR}
              alt={reply.author}
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 break-words">
              <strong>{reply.author}</strong>:{" "}
              {editReplyId === reply.id ? (
                <form
                  onSubmit={handleUpdateReply}
                  className="inline-flex flex-wrap gap-2 items-center"
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
                    onClick={() => {
                      setEditReplyId(null);
                      setEditContent("");
                    }}
                    className="px-2 py-1 bg-gray-400 text-white rounded text-xs"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                reply.content
              )}

              {canEditOrDelete(reply) &&
                editReplyId !== reply.id && (
                  <span className="ml-2 space-x-2 text-xs text-gray-600">
                    <button
                      onClick={() => {
                        setEditReplyId(reply.id);
                        setEditContent(reply.content);
                      }}
                      className="text-blue-500 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        deleteDoc(doc(db, "groupReplies", reply.id))
                      }
                      className="text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </span>
                )}

              {/* Recursive Nested Replies */}
              <GroupReplies
                commentId={commentId}
                parentReplyId={reply.id}
                currentUser={currentUser}
                isAdmin={isAdmin}
                isModerator={isModerator}
                DEFAULT_AVATAR={DEFAULT_AVATAR}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}