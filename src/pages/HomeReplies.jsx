import { useState, useEffect } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import EmojiPicker from "emoji-picker-react";

import { ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
}) {
  const [commentMap, setCommentMap] = useState({});
  const [activeReply, setActiveReply] = useState(null);
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState({});
  const [editReplyMap, setEditReplyMap] = useState({});
  const [editingReplyIndexMap, setEditingReplyIndexMap] = useState({});

  useEffect(() => {
    console.log("commentMap updated:", commentMap);
  }, [commentMap]);

  const handleReply = async (postId, commentIndex) => {
    const replyKey = `${postId}-reply-${commentIndex}`;
    const textarea = document.querySelector(`textarea[name="replyText"][form="${replyKey}"]`);
    const replyText = commentMap[replyKey] || (textarea ? textarea.value : undefined);
    console.log("handleReply called", { postId, commentIndex, replyText, replyKey, commentMap });
    if (!replyText?.trim()) return;
    const postRef = doc(db, "posts", postId);
    const updatedComments = [...comment];
    const reply = {
      text: replyText,
      author: user.displayName || user.email || "Unknown User",
      uid: user.uid,
      role: user.role || "user",
      createdAt: new Date().toISOString(),
      likes: [],
    };
    updatedComments.replies = [...(updatedComments.replies || []), reply];
    try {
      await updateDoc(postRef, { comments: updatedComments });
      setCommentMap((prev) => ({ ...prev, [replyKey]: "" }));
      if (textarea) textarea.value = ""; // Clear textarea directly
      setActiveReply(null);
    } catch (error) {
      console.error("Firestore update failed:", error);
    }
  };

  const handleDeleteReply = async (postId, commentIndex, replyIndex) => {
    const postRef = doc(db, "posts", postId);
    const updatedComments = [...comment];
    updatedComments.replies.splice(replyIndex, 1);
    await updateDoc(postRef, { comments: updatedComments });
  };

  const handleEditReply = async (postId, commentIndex, replyIndex) => {
    const key = `${postId}-${commentIndex}-${replyIndex}`;
    const postRef = doc(db, "posts", postId);
    const updatedComments = [...comment];
    updatedComments.replies[replyIndex].text = editReplyMap[key];
    await updateDoc(postRef, { comments: updatedComments });
    setEditingReplyIndexMap((prev) => ({ ...prev, [key]: false }));
    setEditReplyMap((prev) => ({ ...prev, [key]: "" }));
  };

  const handleLikeReply = async (postId, commentIndex, replyIndex) => {
    const postRef = doc(db, "posts", postId);
    const reply = comment.replies[replyIndex];
    const likes = new Set(reply.likes || []);
    likes.has(user.uid) ? likes.delete(user.uid) : likes.add(user.uid);
    const updatedComments = [...comment];
    updatedComments.replies[replyIndex] = { ...reply, likes: Array.from(likes) };
    await updateDoc(postRef, { comments: updatedComments });
  };

  const addReplyEmoji = (key, emoji) => {
    setCommentMap((prev) => ({
      ...prev,
      [key]: (prev[key] || "") + emoji.emoji,
    }));
    setShowReplyEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  return (
    <>
      <button
        onClick={() =>
          setActiveReply(
            activeReply === `${postId}-reply-${commentIndex}` ? null : `${postId}-reply-${commentIndex}`
          )
        }
        className="text-blue-600 hover:underline"
      >
        Reply
      </button>

      {activeReply === `${postId}-reply-${commentIndex}` && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            console.log("Form submitted for reply");
            handleReply(postId, commentIndex);
          }}
          className="flex items-start space-x-2 mt-1 sm:space-x-1 sm:mt-0.5"
          key={`${postId}-reply-${commentIndex}`} // Unique key to force re-render
        >
          <textarea
            name="replyText"
            placeholder={`Replying to ${commentUser?.displayName || comment.author}...`}
            value={commentMap[`${postId}-reply-${commentIndex}`] || ""}
            onChange={(e) => {
              const key = `${postId}-reply-${commentIndex}`;
              console.log("onChange triggered", { key, value: e.target.value });
              setCommentMap((prev) => ({
                ...prev,
                [key]: e.target.value,
              }));
            }}
            className="border p-1 flex-1 rounded sm:p-0.5"
            autoFocus
          />
          <button
            type="submit"
            className="text-xs bg-yellow-100 text-black-800 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
          >
            Reply
          </button>
          <button
            type="button"
            onClick={() => setActiveReply(null)}
            className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              setShowReplyEmojiPicker((prev) => ({
                ...prev,
                [`${postId}-reply-${commentIndex}`]: !prev[`${postId}-reply-${commentIndex}`],
              }))
            }
            className="text-xs bg-yellow-400 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
          >
            😀
          </button>
        </form>
      )}
      {showReplyEmojiPicker[`${postId}-reply-${commentIndex}`] && (
        <div className="fixed md:relative bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:right-auto z-50 md:z-auto">
          <div className="relative max-w-[350px] mx-auto md:mx-0">
            <button
              onClick={() =>
                setShowReplyEmojiPicker((prev) => ({
                  ...prev,
                  [`${postId}-reply-${commentIndex}`]: false,
                }))
              }
              className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              X
            </button>
            <EmojiPicker
              width="100%"
              height={350}
              onEmojiClick={(emoji) => addReplyEmoji(`${postId}-reply-${commentIndex}`, emoji)}
            />
          </div>
        </div>
      )}

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="ml-5 mt-4 space-y-2 sm:ml-2.5 sm:mt-2">
          {comment.replies.map((reply, ri) => {
            const replyUser = usersMap[reply.uid];
            const replyAvatar = replyUser?.photoURL || DEFAULT_AVATAR;
            const replyKey = `${postId}-${commentIndex}-${ri}`;
            return (
              <div key={ri} className="flex items-start space-x-2 bg-white p-2 rounded">
                <img
                  src={replyAvatar}
                  alt="avatar"
                  className="w-5 h-5 rounded-full object-cover cursor-pointer sm:w-4 sm:h-4"
                  onClick={() => goToProfile(reply.uid)}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 sm:space-x-1">
                    <p
                      className="font-semibold text-gray-800 cursor-pointer"
                      onClick={() => goToProfile(reply.uid)}
                    >
                      {replyUser?.displayName || reply.author}
                      {replyUser?.isAdmin && (
                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                      {replyUser?.isModerator && (
                        <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                          Moderator
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-gray-500">
                      {safeFormatDate(reply.createdAt)}
                    </span>
                  </div>

                  {editingReplyIndexMap[replyKey] ? (
                    <div>
                      <textarea
                        value={editReplyMap[replyKey]}
                        onChange={(e) =>
                          setEditReplyMap((prev) => ({
                            ...prev,
                            [replyKey]: e.target.value,
                          }))
                        }
                        className="border p-1 w-full rounded sm:p-0.5"
                      />
                      <button
                        onClick={() => handleEditReply(postId, commentIndex, ri)}
                        className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1 sm:mt-0.5 sm:px-1 sm:py-0.5"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-900">{reply.text}</p>
                  )}

                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-600 sm:mt-0.5 sm:gap-2">
                    <button
                      className="text-blue-600 hover:underline"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => handleLikeReply(postId, commentIndex, ri)}
                      className={`flex items-center gap-1 hover:underline ${
                        reply.likes?.includes(user?.uid)
                          ? "text-blue-600 font-semibold"
                          : "text-gray-600"
                      }`}
                    >
                      <ThumbsUp size={14} />
                      {reply.likes?.includes(user?.uid) ? "Liked" : "Like"}
                      {reply.likes?.length > 0 && ` (${reply.likes.length})`}
                    </button>
                    {reply.uid === user.uid && !editingReplyIndexMap[replyKey] && (
                      <div className="space-x-2">
                        <button
                          onClick={() => {
                            setEditingReplyIndexMap((prev) => ({
                              ...prev,
                              [replyKey]: true,
                            }));
                            setEditReplyMap((prev) => ({
                              ...prev,
                              [replyKey]: reply.text,
                            }));
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteReply(postId, commentIndex, ri)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}