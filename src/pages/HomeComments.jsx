import { useState } from "react";
import { updateDoc, doc, arrayUnion } from "firebase/firestore";
import { db, storage } from "../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import EmojiPicker from "emoji-picker-react";
import { ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import HomeReplies from "./HomeReplies";

export default function HomeComments({
  post,
  postUser,
  postAvatar,
  user,
  usersMap,
  handleDeletePost,
  goToProfile,
  safeFormatDate,
}) {
  const [commentMap, setCommentMap] = useState({});
  const [editCommentMap, setEditCommentMap] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState({});

  const handleComment = async (id) => {
    const comment = commentMap[id];
    if (!comment?.trim()) return;
    const postRef = doc(db, "posts", id);
    const newComment = {
      text: comment,
      author: user.displayName || user.email || "Unknown User",
      uid: user.uid,
      role: user.role || "user",
      createdAt: new Date().toISOString(),
      likes: [],
      replies: [],
    };
    const updatedComments = [...(post.comments || []), newComment];
    await updateDoc(postRef, { comments: updatedComments });
    setCommentMap((prev) => ({ ...prev, [id]: "" }));
  };

  const handleEditPost = async (postId) => {
    await updateDoc(doc(db, "posts", postId), { content: editedContent });
    setEditingPostId(null);
    setEditedContent("");
  };

  const addEmoji = (key, emoji) => {
    setCommentMap((prev) => ({
      ...prev,
      [key]: (prev[key] || "") + emoji.emoji,
    }));
    setShowEmojiPicker((prev) => ({ ...prev, [key]: false }));
  };

  const handleDeleteComment = async (postId, index) => {
    const updatedComments = [...post.comments];
    updatedComments.splice(index, 1);
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
  };

  const handleEditComment = async (postId, index) => {
    const newText = editCommentMap[`${postId}-${index}`];
    if (!newText?.trim()) return;
    const updatedComments = [...post.comments];
    updatedComments[index].text = newText;
    await updateDoc(doc(db, "posts", postId), { comments: updatedComments });
    setEditCommentMap((prev) => ({ ...prev, [`${postId}-${index}`]: "" }));
  };

  const handleLikeComment = async (postId, commentIndex) => {
    const postRef = doc(db, "posts", postId);
    const comment = post.comments[commentIndex];
    const likes = new Set(comment.likes || []);
    likes.has(user.uid) ? likes.delete(user.uid) : likes.add(user.uid);
    const updatedComments = post.comments.map((c, i) =>
      i === commentIndex ? { ...c, likes: Array.from(likes) } : c
    );
    await updateDoc(postRef, { comments: updatedComments });
  };

  return (
    <>
      {/* New Comment input at top */}
      <div className="flex items-start space-x-2 mt-4 sm:space-x-1 sm:mt-2">
        <textarea
          placeholder="Write a comment..."
          value={commentMap[post.id] || ""}
          onChange={(e) =>
            setCommentMap((prev) => ({
              ...prev,
              [post.id]: e.target.value,
            }))
          }
          className="border p-1 flex-1 rounded sm:p-0.5"
        />
        <button
          onClick={() => handleComment(post.id)}
          className="text-xs bg-yellow-100 text-black-800 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
        >
          Comment
        </button>
        <button
          onClick={() =>
            setShowEmojiPicker((prev) => ({
              ...prev,
              [post.id]: !prev[post.id],
            }))
          }
          className="text-xs bg-yellow-400 px-2 py-0.5 rounded sm:px-1 sm:py-0.5"
        >
          😀
        </button>
      </div>
      {showEmojiPicker[post.id] && (
        <div className="fixed md:relative bottom-0 md:bottom-auto left-0 right-0 md:left-auto md:right-auto z-50 md:z-auto">
          <div className="relative max-w-[350px] mx-auto md:mx-0">
            <button
              onClick={() =>
                setShowEmojiPicker((prev) => ({
                  ...prev,
                  [post.id]: false,
                }))
              }
              className="absolute -top-3 -right-3 z-10 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              X
            </button>
            <EmojiPicker
              width="100%"
              height={350}
              onEmojiClick={(emoji) => addEmoji(post.id, emoji)}
            />
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="mt-4 space-y-4 sm:mt-2">
        {(post.comments || []).map((comment, i) => {
          const commentUser = usersMap[comment.uid];
          const commentAvatar = commentUser?.photoURL || DEFAULT_AVATAR;
          return (
            <div key={i} className="ml-5 sm:ml-2.5">
              <div className="flex items-start space-x-2 bg-white p-2 rounded">
                <img
                  src={commentAvatar}
                  alt="avatar"
                  className="w-6 h-6 rounded-full object-cover cursor-pointer sm:w-5 sm:h-5"
                  onClick={() => goToProfile(comment.uid)}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 sm:space-x-1">
                    <p
                      className="font-semibold text-gray-800 cursor-pointer"
                      onClick={() => goToProfile(comment.uid)}
                    >
                      {commentUser?.displayName || comment.author}
                      {commentUser?.isAdmin && (
                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                      {commentUser?.isModerator && (
                        <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                          Moderator
                        </span>
                      )}
                    </p>
                    <span className="text-xs text-gray-500">
                      {safeFormatDate(comment.createdAt)}
                    </span>
                  </div>

                  {editCommentMap[`${post.id}-${i}`] !== undefined ? (
                    <div>
                      <textarea
                        value={editCommentMap[`${post.id}-${i}`]}
                        onChange={(e) =>
                          setEditCommentMap((prev) => ({
                            ...prev,
                            [`${post.id}-${i}`]: e.target.value,
                          }))
                        }
                        className="border p-1 w-full rounded sm:p-0.5"
                      />
                      <button
                        onClick={() => handleEditComment(post.id, i)}
                        className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1 sm:mt-0.5 sm:px-1 sm:py-0.5"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-900">{comment.text}</p>
                  )}

                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-600 sm:mt-0.5 sm:gap-2">
                    <button
                      className="text-blue-600 hover:underline"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => handleLikeComment(post.id, i)}
                      className={`flex items-center gap-1 hover:underline ${
                        comment.likes?.includes(user?.uid)
                          ? "text-blue-600 font-semibold"
                          : "text-gray-600"
                      }`}
                    >
                      <ThumbsUp size={14} />
                      {comment.likes?.includes(user?.uid) ? "Liked" : "Like"}
                      {comment.likes?.length > 0 && ` (${comment.likes.length})`}
                    </button>
                    {comment.uid === user.uid &&
                      editCommentMap[`${post.id}-${i}`] === undefined && (
                        <div className="space-x-2">
                          <button
                            onClick={() =>
                              setEditCommentMap((prev) => ({
                                ...prev,
                                [`${post.id}-${i}`]: comment.text,
                              }))
                            }
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteComment(post.id, i)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                  </div>

                  <HomeReplies
                    postId={post.id}
                    comment={comment}
                    commentIndex={i}
                    commentUser={commentUser}
                    commentAvatar={commentAvatar}
                    user={user}
                    usersMap={usersMap}
                    goToProfile={goToProfile}
                    safeFormatDate={safeFormatDate}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}