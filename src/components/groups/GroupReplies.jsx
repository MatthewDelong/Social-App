import { useEffect, useState, Fragment, useRef } from "react";
import { createPortal } from "react-dom";
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
import EmojiPicker from "emoji-picker-react";
import { ThumbsUp, X } from "lucide-react";

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef(null);

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
          console.log("Replies fetched for parentReplyId", parentReplyId, ":", docs);
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
      console.log("Adding reply with parentId:", parentId);
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
      setReplyText("");
      setShowEmojiPicker(null);
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

  const handleEmojiClick = (emojiObject, replyId) => {
    setReplyText((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(null);
  };

  const visibleReplies = replies.slice(0, visibleCount);

  return (
    <div className="mt-2" style={{ position: "relative", maxWidth: "90vw" }}>
      <div
        className="space-y-2 relative"
        style={{
          marginLeft: depth * 20 + "px",
        }}
      >
        {(depth === 0 || depth > 0) && (
          <div
            className="absolute left-[-20px] top-0 bottom-0"
            style={{
              borderLeft: "2px solid #b1aeae",
              marginLeft: "-1px",
              zIndex: 0,
            }}
          />
        )}
        {visibleReplies.map((reply, index) => (
          <Fragment key={reply.id}>
            <div
              className="border rounded bg-white flex items-start gap-2 relative"
              style={{ position: "relative", zIndex: 1 }}
            >
              {depth < 5 && (
                <div
                  className="absolute left-[-20px] top-[50%]"
                  style={{
                    width: "20px",
                    borderBottom: "2px solid #b1aeae",
                    marginLeft: "-1px",
                    transform: "translateY(-50%)",
                    zIndex: 0,
                  }}
                />
              )}
              <img
                src={reply.authorPhotoURL || DEFAULT_AVATAR}
                alt={reply.author}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0 sm:w-6 sm:h-6"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-1">
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
                  <form onSubmit={handleUpdateReply} className="mt-1 sm:mt-0.5">
                    <input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2 border rounded text-sm mb-2 sm:p-1 sm:mb-1"
                      autoFocus
                    />
                    <div className="space-x-2 sm:space-x-1">
                      <button
                        type="submit"
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs sm:px-1 sm:py-0.5"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditReplyId(null);
                          setEditContent("");
                        }}
                        className="px-2 py-1 bg-gray-400 text-white rounded text-xs sm:px-1 sm:py-0.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-1 break-words sm:mt-0.5">{reply.content}</p>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 sm:mt-0.5 sm:gap-1 max-w-full">
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
                      handleAddReply(reply.id, replyText, reply.author);
                      setActiveReplyBox(null);
                      setReplyText("");
                      setShowEmojiPicker(null);
                    }}
                    className="flex flex-wrap gap-2 mt-2 sm:gap-1 sm:mt-1 relative"
                  >
                    <div className="flex items-center w-full relative">
                      <input
                        ref={inputRef}
                        name="replyText"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Replying to ${reply.author}...`}
                        className="flex-1 min-w-[150px] p-2 pr-10 border rounded text-sm sm:p-1 sm:min-w-[100px]"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowEmojiPicker(
                            showEmojiPicker === reply.id ? null : reply.id
                          )
                        }
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        😊
                      </button>
                    </div>
                    {showEmojiPicker === reply.id &&
                      createPortal(
                        <div
                          className="absolute z-50"
                          style={{
                            top: inputRef.current
                              ? inputRef.current.getBoundingClientRect().bottom +
                                window.scrollY +
                                2
                              : "auto",
                            right: inputRef.current
                              ? window.innerWidth -
                                inputRef.current.getBoundingClientRect().right
                              : "auto",
                          }}
                        >
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowEmojiPicker(null)}
                              className="absolute top-2 right-2 z-60 bg-gray-200 rounded-full p-1 hover:bg-gray-300"
                              title="Close emoji picker"
                            >
                              <X size={16} />
                            </button>
                            <EmojiPicker
                              onEmojiClick={(emojiObject) =>
                                handleEmojiClick(emojiObject, reply.id)
                              }
                            />
                          </div>
                        </div>,
                        document.body
                      )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-3 py-2 bg-gray-700 text-white rounded text-sm sm:px-2 sm:py-1"
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReplyBox(null);
                          setReplyText("");
                          setShowEmojiPicker(null);
                        }}
                        className="px-3 py-2 bg-gray-400 text-white rounded text-sm sm:px-2 sm:py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-2 sm:mt-1">
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
          <div className="flex gap-2 sm:gap-1">
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