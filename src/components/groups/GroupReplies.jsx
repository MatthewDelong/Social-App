// src/components/groups/GroupReplies.jsx
import { useEffect, useState, Fragment } from "react";
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
import { formatDistanceToNow } from "date-fns";
import { arrayUnion, arrayRemove } from "firebase/firestore";
import { ThumbsUp } from "lucide-react"; // 👍 icon

export default function GroupReplies({
  commentId,
  parentReplyId = null,
  currentUser,
  isAdmin,
  isModerator,
  DEFAULT_AVATAR,
}) {
  const [replies, setReplies] = useState([]);
  const [editReplyId, setEditReplyId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const INITIAL_VISIBLE = 3;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [activeReplyBox, setActiveReplyBox] = useState(null);

  useEffect(() => {
    if (!commentId) return;
    let unsub;
    (async () => {
      try {
        const q = query(
          collection(db, "groupReplies"),
          where("commentId", "==", commentId),
          where("parentReplyId", "==", parentReplyId),
          orderBy("createdAt", "asc")
        );

        unsub = onSnapshot(q, async (snapshot) => {
          const docs = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));

          const updated = await Promise.all(
            docs.map(async (reply) => {
              try {
                if (reply.uid) {
                  const userDoc = await getDoc(doc(db, "users", reply.uid));
                  if (userDoc.exists()) {
                    return {
                      ...reply,
                      authorPhotoURL:
                        userDoc.data().photoURL || DEFAULT_AVATAR,
                      likes: reply.likes || [],
                    };
                  }
                }
              } catch {}
              return { ...reply, authorPhotoURL: DEFAULT_AVATAR, likes: reply.likes || [] };
            })
          );

          setReplies(updated);
        });
      } catch (err) {
        console.error("Replies listener error:", err);
      }
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [commentId, parentReplyId, DEFAULT_AVATAR]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [commentId, parentReplyId]);

  const canEditOrDelete = (reply) => {
    if (!currentUser) return false;
    return reply.uid === currentUser.uid || isAdmin || isModerator;
  };

  const formatReplyDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true }).replace("about ", "");
    } catch {
      return "";
    }
  };

  const handleAddReply = async (parentId, text) => {
    if (!currentUser || !text.trim()) return;
    try {
      await addDoc(collection(db, "groupReplies"), {
        commentId,
        parentReplyId: parentId ?? null,
        uid: currentUser.uid,
        author: currentUser.displayName,
        authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR,
        content: text.trim(),
        createdAt: serverTimestamp(),
        likes: [],
      });
    } catch (err) {
      console.error("Error adding reply:", err);
    }
  };

  const handleUpdateReply = async (e) => {
    e.preventDefault();
    if (!editContent.trim() || !editReplyId) return;
    try {
      await updateDoc(doc(db, "groupReplies", editReplyId), {
        content: editContent.trim(),
        editedAt: serverTimestamp(),
      });
      setEditReplyId(null);
      setEditContent("");
    } catch (err) {
      console.error("Error updating reply:", err);
    }
  };

  const toggleLike = async (reply) => {
    if (!currentUser) return;
    const replyRef = doc(db, "groupReplies", reply.id);
    try {
      if (reply.likes?.includes(currentUser.uid)) {
        await updateDoc(replyRef, {
          likes: arrayRemove(currentUser.uid),
        });
      } else {
        await updateDoc(replyRef, {
          likes: arrayUnion(currentUser.uid),
        });
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  const visibleReplies = replies.slice(0, visibleCount);

  return (
    <div className="mt-2">
      <div className="space-y-2">
        {visibleReplies.map((reply) => (
          <Fragment key={reply.id}>
            <div className="border p-2 rounded text-sm bg-white flex items-start gap-2">
              <img
                src={reply.authorPhotoURL || DEFAULT_AVATAR}
                alt={reply.author}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{reply.author}</strong>
                  {reply.createdAt && (
                    <span className="text-xs text-gray-500">
                      {formatReplyDate(reply.createdAt)}
                    </span>
                  )}
                </div>

                {editReplyId === reply.id ? (
                  <form onSubmit={handleUpdateReply} className="mt-1">
                    <input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2 border rounded text-sm mb-2"
                      autoFocus
                    />
                    <div className="space-x-2">
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
                    </div>
                  </form>
                ) : (
                  <p className="mt-1 break-words">{reply.content}</p>
                )}

                <div className="mt-1 flex items-center gap-4 text-xs text-gray-600">
                  {/* Reply button */}
                  <button
                    onClick={() =>
                      setActiveReplyBox(
                        activeReplyBox === reply.id ? null : reply.id
                      )
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reply
                  </button>

                  {/* Like button with icon */}
                  <button
                    onClick={() => toggleLike(reply)}
                    className={`flex items-center gap-1 hover:underline ${
                      reply.likes?.includes(currentUser?.uid)
                        ? "text-blue-600 font-semibold"
                        : "text-gray-600"
                    }`}
                  >
                    <ThumbsUp size={14} />
                    {reply.likes?.includes(currentUser?.uid) ? "Liked" : "Like"}
                  </button>

                  {/* Show like count */}
                  {reply.likes?.length > 0 && (
                    <span className="text-gray-500">
                      {reply.likes.length} {reply.likes.length === 1 ? "Like" : "Likes"}
                    </span>
                  )}

                  {/* Edit/Delete only for owner or admin */}
                  {canEditOrDelete(reply) && editReplyId !== reply.id && (
                    <>
                      <button
                        onClick={() => {
                          setEditReplyId(reply.id);
                          setEditContent(reply.content);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm("Delete this reply?")) {
                            try {
                              await deleteDoc(doc(db, "groupReplies", reply.id));
                            } catch (err) {
                              console.error("Error deleting reply:", err);
                            }
                          }
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {/* Inline reply input */}
                {activeReplyBox === reply.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const text = e.target.elements.replyText.value;
                      handleAddReply(reply.id, text);
                      setActiveReplyBox(null);
                      e.target.reset();
                    }}
                    className="flex flex-wrap gap-2 mt-2"
                  >
                    <input
                      name="replyText"
                      placeholder="Write a reply..."
                      className="flex-1 min-w-[150px] p-2 border rounded text-sm"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-gray-700 text-white rounded text-sm"
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveReplyBox(null)}
                      className="px-3 py-2 bg-gray-400 text-white rounded text-sm"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Nested replies */}
            <div className="mt-2">
              <GroupReplies
                commentId={commentId}
                parentReplyId={reply.id}
                currentUser={currentUser}
                isAdmin={isAdmin}
                isModerator={isModerator}
                DEFAULT_AVATAR={DEFAULT_AVATAR}
              />
            </div>
          </Fragment>
        ))}

        {replies.length > visibleCount && (
          <button
            onClick={() =>
              setVisibleCount((prev) =>
                Math.min(prev + INITIAL_VISIBLE, replies.length)
              )
            }
            className="text-xs text-blue-600 hover:underline"
          >
            View {replies.length - visibleCount} more replies
          </button>
        )}
        {visibleCount > INITIAL_VISIBLE && (
          <button
            onClick={() => setVisibleCount(INITIAL_VISIBLE)}
            className="ml-2 text-xs text-blue-600 hover:underline"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
