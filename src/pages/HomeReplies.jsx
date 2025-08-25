import { useEffect, useState } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUp } from "lucide-react";

export default function HomeReplies({
  postId,
  comment,
  commentIndex,
  commentUser,
  commentAvatar,
  user,
  usersMap,
  goToProfile,
  safeFormatDate,
  depth = 0,
}) {
  const [editReplyId, setEditReplyId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const INITIAL_VISIBLE = 3;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [activeReplyBox, setActiveReplyBox] = useState(null);
  const DEFAULT_AVATAR = "https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc";

  const canEditOrDelete = (reply) => {
    if (!user) return false;
    return reply.uid === user.uid || user?.isAdmin || user?.isModerator;
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

  const handleAddReply = async (parentReplyId, text, replyingTo = null) => {
    if (!user || !text.trim()) return;
    try {
      const updatedComment = {
        ...comment,
        replies: [
          ...(comment.replies || []),
          {
            text: text.trim(),
            author: user.displayName || user.email || "Unknown User",
            uid: user.uid,
            role: user.role || "user",
            createdAt: new Date().toISOString(),
            likes: [],
            replyingTo,
          },
        ],
      };
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        comments: commentIndex !== undefined
          ? [
              ...comment.comments.slice(0, commentIndex),
              updatedComment,
              ...comment.comments.slice(commentIndex + 1),
            ]
          : [updatedComment],
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
      const replyIndex = comment.replies.findIndex((r) => r.id === editReplyId);
      if (replyIndex >= 0) {
        const updatedComment = {
          ...comment,
          replies: comment.replies.map((r, i) =>
            i === replyIndex ? { ...r, text: editContent.trim(), editedAt: serverTimestamp() } : r
          ),
        };
        const postRef = doc(db, "posts", postId);
        await updateDoc(postRef, {
          comments: commentIndex !== undefined
            ? [
                ...comment.comments.slice(0, commentIndex),
                updatedComment,
                ...comment.comments.slice(commentIndex + 1),
              ]
            : [updatedComment],
        });
        setEditReplyId(null);
        setEditContent("");
      }
    } catch (err) {
      console.error("Error updating reply:", err);
    }
  };

  const toggleLike = async (reply) => {
    if (!user) return;
    const replyIndex = comment.replies.findIndex((r) => r === reply);
    if (replyIndex >= 0) {
      const updatedComment = {
        ...comment,
        replies: comment.replies.map((r, i) =>
          i === replyIndex
            ? {
                ...r,
                likes: r.likes?.includes(user.uid)
                  ? r.likes.filter((uid) => uid !== user.uid)
                  : [...(r.likes || []), user.uid],
              }
            : r
        ),
      };
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        comments: commentIndex !== undefined
          ? [
              ...comment.comments.slice(0, commentIndex),
              updatedComment,
              ...comment.comments.slice(commentIndex + 1),
            ]
          : [updatedComment],
      });
    }
  };

  const handleDeleteReply = async (replyId) => {
    if (!window.confirm("Delete this reply?")) return;
    const replyIndex = comment.replies.findIndex((r) => r.id === replyId);
    if (replyIndex >= 0) {
      const updatedComment = {
        ...comment,
        replies: comment.replies.filter((_, i) => i !== replyIndex),
      };
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        comments: commentIndex !== undefined
          ? [
              ...comment.comments.slice(0, commentIndex),
              updatedComment,
              ...comment.comments.slice(commentIndex + 1),
            ]
          : [updatedComment],
      });
    }
  };

  const visibleReplies = (comment.replies || []).slice(0, visibleCount);

  return (
    <div className="mt-2" style={{ position: "relative", maxWidth: "90vw" }}>
      <div
        className="space-y-2 relative"
        style={{ marginLeft: depth * 20 + "px" }}
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
          <>
            <div
              key={index}
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
                onClick={() => goToProfile(reply.uid)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-1">
                  <strong
                    className="text-sm cursor-pointer"
                    onClick={() => goToProfile(reply.uid)}
                  >
                    {usersMap[reply.uid]?.displayName || reply.author}
                    {usersMap[reply.uid]?.isAdmin && (
                      <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                    {usersMap[reply.uid]?.isModerator && (
                      <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                        Moderator
                      </span>
                    )}
                  </strong>
                  {reply.createdAt && (
                    <span className="text-xs text-gray-500">
                      {safeFormatDate(reply.createdAt)}
                    </span>
                  )}
                </div>

                {reply.replyingTo && (
                  <p className="text-xs text-gray-500">
                    Replying to @{reply.replyingTo}
                  </p>
                )}

                {editReplyId === index ? (
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
                  <p className="mt-1 break-words sm:mt-0.5">{reply.text}</p>
                )}

                <div className="mt-1 flex items-center gap-4 text-xs text-gray-600 sm:mt-0.5 sm:gap-2">
                  <button
                    onClick={() =>
                      setActiveReplyBox(
                        activeReplyBox === index ? null : index
                      )
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reply
                  </button>

                  <button
                    onClick={() => toggleLike(reply)}
                    className={`flex items-center gap-1 hover:underline ${
                      reply.likes?.includes(user?.uid)
                        ? "text-blue-600 font-semibold"
                        : "text-gray-600"
                    }`}
                  >
                    <ThumbsUp size={14} />
                    {reply.likes?.includes(user?.uid) ? "Liked" : "Like"}
                  </button>

                  {reply.likes?.length > 0 && (
                    <span className="text-gray-500">
                      {reply.likes.length}{" "}
                      {reply.likes.length === 1 ? "Like" : "Likes"}
                    </span>
                  )}

                  {canEditOrDelete(reply) && editReplyId !== index && (
                    <>
                      <button
                        onClick={() => {
                          setEditReplyId(index);
                          setEditContent(reply.text);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteReply(index)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {activeReplyBox === index && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const text = e.target.elements.replyText.value;
                      handleAddReply(index, text, reply.author);
                      setActiveReplyBox(null);
                      e.target.reset();
                    }}
                    className="flex flex-wrap gap-2 mt-2 sm:gap-1 sm:mt-1"
                  >
                    <input
                      name="replyText"
                      placeholder={`Replying to ${reply.author}...`}
                      className="flex-1 min-w-[150px] p-2 border rounded text-sm sm:p-1 sm:min-w-[100px]"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-gray-700 text-white rounded text-sm sm:px-2 sm:py-1"
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveReplyBox(null)}
                      className="px-3 py-2 bg-gray-400 text-white rounded text-sm sm:px-2 sm:py-1"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="mt-2 sm:mt-1">
              <HomeReplies
                postId={postId}
                comment={comment}
                commentIndex={commentIndex}
                commentUser={commentUser}
                commentAvatar={commentAvatar}
                user={user}
                usersMap={usersMap}
                goToProfile={goToProfile}
                safeFormatDate={safeFormatDate}
                parentReplyId={index}
                depth={depth + 1}
              />
            </div>
          </>
        ))}

        {(comment.replies || []).length > INITIAL_VISIBLE && (
          <div className="flex gap-2 sm:gap-1">
            {(comment.replies || []).length > visibleCount && (
              <button
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + INITIAL_VISIBLE, (comment.replies || []).length)
                  )
                }
                className="text-xs text-blue-600 hover:underline"
              >
                Show more replies ({(comment.replies || []).length - visibleCount})
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