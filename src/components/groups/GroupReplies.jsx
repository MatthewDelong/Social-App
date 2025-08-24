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
} from "firebase/firestore";
import { db } from "../../firebase";
import { formatDistanceToNow } from "date-fns";
import { arrayUnion, arrayRemove } from "firebase/firestore";
import { ThumbsUp } from "lucide-react";

export default function GroupReplies({
  commentId,
  parentReplyId = null,
  currentUser,
  isAdmin,
  isModerator,
  DEFAULT_AVATAR,
  depth = 0,
}) {
  const [replies, setReplies] = useState([]);
  const [editReplyId, setEditReplyId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const INITIAL_VISIBLE = 3;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [activeReplyBox, setActiveReplyBox] = useState(null);

  // Optimized listener for replies
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

        unsub = onSnapshot(q, (snapshot) => {
          const docs = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...data,
              authorPhotoURL: data.authorPhotoURL || DEFAULT_AVATAR,
              likes: data.likes || [],
            };
          });
          console.log("Replies fetched for parentReplyId", parentReplyId, ":", docs); // Debug log
          setReplies(docs);
          setVisibleCount(INITIAL_VISIBLE);
        });
      } catch (err) {
        console.error("Replies listener error:", err);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [commentId, parentReplyId, DEFAULT_AVATAR]);

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

  const handleAddReply = async (parentId, text, replyingTo = null) => {
    if (!currentUser || !text.trim()) return;
    try {
      console.log("Adding reply with parentId:", parentId); // Debug log for parentId
      await addDoc(collection(db, "groupReplies"), {
        commentId,
        parentReplyId: parentId ?? null,
        uid: currentUser.uid,
        author: currentUser.displayName,
        authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR,
        content: text.trim(),
        createdAt: serverTimestamp(),
        likes: [],
        replyingTo,
      });
      setActiveReplyBox(null);
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
    <div className="mt-2" style={{ position: "relative" }}>
      <div className="space-y-2 relative" style={{ marginLeft: depth * 20 + "px" }}>
        {/* Continuous Vertical Line for the Thread */}
        {depth > 0 && (
          <div
            className="absolute left-[-20px] top-0 bottom-0"
            style={{
              borderLeft: "2px solid #666",
              marginLeft: "-1px",
              zIndex: 0, // Behind content
            }}
          />
        )}
        {visibleReplies.map((reply, index) => (
          <Fragment key={reply.id}>
            <div
              className="border p-2 rounded text-sm bg-white flex items-start gap-2 relative"
              style={{ position: "relative", zIndex: 1 }}
            >
              {/* Horizontal Connection Line (triggered by nested GroupReplies) */}
              {depth < 5 && visibleReplies.length > index + 1 && ( // Simplified condition based on next reply
                <div
                  className="absolute left-[-20px] top-[50%]"
                  style={{
                    width: "20px",
                    borderBottom: "2px solid #666",
                    marginLeft: "-1px",
                    transform: "translateY(-50%)",
                  }}
                />
              )}
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

                {reply.replyingTo && (
                  <p className="text-xs text-gray-500">
                    Replying to @{reply.replyingTo}
                  </p>
                )}

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

                  {reply.likes?.length > 0 && (
                    <span className="text-gray-500">
                      {reply.likes.length}{" "}
                      {reply.likes.length === 1 ? "Like" : "Likes"}
                    </span>
                  )}

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

                {activeReplyBox === reply.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const text = e.target.elements.replyText.value;
                      handleAddReply(reply.id, text, reply.author);
                      setActiveReplyBox(null);
                      e.target.reset();
                    }}
                    className="flex flex-wrap gap-2 mt-2"
                  >
                    <input
                      name="replyText"
                      placeholder={`Replying to ${reply.author}...`}
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

            <div className="mt-2">
              <GroupReplies
                commentId={commentId}
                parentReplyId={reply.id}
                currentUser={currentUser}
                isAdmin={isAdmin}
                isModerator={isModerator}
                DEFAULT_AVATAR={DEFAULT_AVATAR}
                depth={depth + 1}
              />
            </div>
          </Fragment>
        ))}

        {replies.length > INITIAL_VISIBLE && (
          <div className="flex gap-2">
            {replies.length > visibleCount && (
              <button
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + INITIAL_VISIBLE, replies.length)
                  )
                }
                className="text-xs text-blue-600 hover:underline"
              >
                Show more replies ({replies.length - visibleCount})
              </button>
            )}
            {visibleCount > INITIAL_VISIBLE && (
              <button
                onClick={() => setVisibleCount(INITIAL_VISIBLE)}
                className="text-xs text-blue-600 hover:underline"
              >
                Show fewer replies
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}