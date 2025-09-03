import { useEffect, useState, Fragment, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { getDocs } from "firebase/firestore";
import EmojiPicker from "emoji-picker-react";
import { ThumbsUp, X } from "lucide-react";
import { useGroupPermissions } from "../../hooks/useGroupPermissions";
import RoleBadge from "./RoleBadge";

export default function GroupReplies({
  commentId,
  parentReplyId = null,
  currentUser,
  groupId,
  DEFAULT_AVATAR,
  depth = 0,
}) {
  const [replies, setReplies] = useState([]);
  const [editReplyId, setEditReplyId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [usersMap, setUsersMap] = useState({});
  const [error, setError] = useState("");
  const INITIAL_VISIBLE = 3;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [activeReplyBox, setActiveReplyBox] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef(null);

  // Get group permissions
  const {
    isMember,
    canEditContent,
    canDeleteContent,
    getUserRole,
    loading: permissionsLoading,
  } = useGroupPermissions(groupId, currentUser?.uid);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const map = {};
        snap.forEach((d) => {
          map[d.id] = d.data();
        });
        setUsersMap(map);
      } catch {}
    })();
  }, []);

  const resolveHandleToUid = (handle) => {
    const lower = (handle || "").toLowerCase();
    for (const [uid, u] of Object.entries(usersMap || {})) {
      const dn = (u?.displayName || "").toLowerCase().trim();
      const un = (u?.username || "").toLowerCase().trim();
      const first = dn.split(" ")[0];
      if (un && un === lower) return uid;
      if (dn && dn === lower) return uid;
      if (first && first === lower) return uid;
    }
    return null;
  };

  const renderWithMentions = (text) => {
    if (!text) return null;
    const parts = [];
    let last = 0;
    const regex = /@([A-Za-z0-9_]+(?:\s+[A-Za-z0-9_]+)?)/g;
    text.replace(regex, (match, handle, index) => {
      if (index > last) parts.push(text.slice(last, index));
      const uid = resolveHandleToUid(handle);
      if (uid) {
        parts.push(
          <span
            key={index}
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={(e) => {
              e.stopPropagation?.();
              navigate(`/profile/${uid}`);
            }}
          >
            {match}
          </span>
        );
      } else {
        parts.push(match);
      }
      last = index + match.length;
      return match;
    });
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

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
          console.log(
            "Replies fetched for parentReplyId",
            parentReplyId,
            ":",
            docs
          );
          setReplies(docs);
          setVisibleCount(INITIAL_VISIBLE);
        });
      } catch (err) {
        console.error("Replies listener error:", err);
        setError("Failed to load replies. Please refresh the page.");
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [commentId, parentReplyId, DEFAULT_AVATAR]);

  const formatReplyDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true })
        .replace("about ", "")
        .replace("minutes ago", "mins ago")
        .replace("minute ago", "min ago");
    } catch {
      return "";
    }
  };

  const handleAddReply = async (parentId, text, replyingTo = null) => {
    if (!currentUser) {
      setError("Please log in to reply.");
      return;
    }

    if (!isMember) {
      setError("Only group members can reply.");
      return;
    }

    if (!text.trim()) {
      setError("Reply cannot be empty.");
      return;
    }

    try {
      setError("");
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
      setError("Failed to add reply. Please try again.");
    }
  };

  const handleUpdateReply = async (e) => {
    e.preventDefault();
    if (!editContent.trim() || !editReplyId) return;

    try {
      setError("");
      await updateDoc(doc(db, "groupReplies", editReplyId), {
        content: editContent.trim(),
        editedAt: serverTimestamp(),
      });
      setEditReplyId(null);
      setEditContent("");
    } catch (err) {
      console.error("Error updating reply:", err);
      setError("Failed to update reply. Please try again.");
    }
  };

  const handleDeleteReply = async (replyId) => {
    if (!window.confirm("Delete this reply?")) return;

    try {
      setError("");
      await deleteDoc(doc(db, "groupReplies", replyId));
    } catch (err) {
      console.error("Error deleting reply:", err);
      setError("Failed to delete reply. Please try again.");
    }
  };

  const toggleLike = async (reply) => {
    if (!currentUser) {
      setError("Please log in to like replies.");
      return;
    }

    if (!isMember) {
      setError("Only group members can like replies.");
      return;
    }

    const replyRef = doc(db, "groupReplies", reply.id);
    try {
      setError("");
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
      setError("Failed to update like. Please try again.");
    }
  };

  const handleEmojiClick = (emojiObject, replyId) => {
    setReplyText((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(null);
  };

  const handleReplyClick = (replyId) => {
    if (!currentUser) {
      setError("Please log in to reply.");
      return;
    }

    if (!isMember) {
      setError("Only group members can reply.");
      return;
    }

    setError("");
    setActiveReplyBox(activeReplyBox === replyId ? null : replyId);
  };

  const visibleReplies = replies.slice(0, visibleCount);

  return (
    <div className="mt-2" style={{ position: "relative", maxWidth: "90vw" }}>
      {/* Error message */}
      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

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
              className="border rounded-xl bg-white flex items-start gap-2 relative"
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
                className="w-7 h-7 border-2 border-white bg-gray-100 rounded-full object-cover flex-shrink-0 sm:w-6 sm:h-6"
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-1">
                  <strong className="text-sm">{reply.author}</strong>
                  <RoleBadge
                    role={getUserRole ? getUserRole(reply.uid) : null}
                    size="xs"
                  />
                  {reply.createdAt && (
                    <span className="text-xs text-gray-500">
                      {formatReplyDate(reply.createdAt)}
                    </span>
                  )}
                  {reply.editedAt && (
                    <span className="text-xs text-gray-400">(edited)</span>
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
                        disabled={!editContent.trim()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditReplyId(null);
                          setEditContent("");
                          setError("");
                        }}
                        className="px-2 py-1 bg-gray-400 text-white rounded text-xs sm:px-1 sm:py-0.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-1 break-words sm:mt-0.5">
                    {renderWithMentions(reply.content)}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 sm:mt-0.5 sm:gap-1 max-w-full">
                  <button
                    onClick={() => {
                      const first = (reply.author || "").split(" ")[0] || "";
                      if (activeReplyBox !== reply.id && first) {
                        setReplyText((prev) => {
                          const at = `@${first}: `;
                          return prev.startsWith(at) ? prev : at + prev;
                        });
                      }
                      handleReplyClick(reply.id);
                    }}
                    className="text-blue-600 hover:underline"
                    disabled={permissionsLoading}
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
                    disabled={permissionsLoading}
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

                  {canEditContent(reply.uid) && editReplyId !== reply.id && (
                    <button
                      onClick={() => {
                        setEditReplyId(reply.id);
                        setEditContent(reply.content);
                        setError("");
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}

                  {canDeleteContent(reply.uid) && editReplyId !== reply.id && (
                    <button
                      onClick={() => handleDeleteReply(reply.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {activeReplyBox === reply.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddReply(reply.id, replyText, reply.author);
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
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                          <div className="bg-white shadow-lg rounded-lg p-2 border max-w-sm w-full mx-4 relative">
                            <button
                              type="button"
                              onClick={() => setShowEmojiPicker(null)}
                              className="absolute top-2 right-2 z-10 bg-gray-100 hover:bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center text-gray-600 font-bold"
                              title="Close emoji picker"
                            >
                              ×
                            </button>
                            <EmojiPicker
                              onEmojiClick={(emojiObject) =>
                                handleEmojiClick(emojiObject, reply.id)
                              }
                              width={280}
                              height={350}
                            />
                          </div>
                        </div>,
                        document.body
                      )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-3 py-2 bg-gray-700 text-white rounded text-sm sm:px-2 sm:py-1"
                        disabled={!replyText.trim()}
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReplyBox(null);
                          setReplyText("");
                          setShowEmojiPicker(null);
                          setError("");
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
                groupId={groupId}
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
