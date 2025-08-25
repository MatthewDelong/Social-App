import { useState, useEffect } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { ThumbsUp } from "lucide-react";
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
  const [content, setContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [activeReplyBox, setActiveReplyBox] = useState(null);
  const DEFAULT_AVATAR =
    "https://firebasestorage.googleapis.com/v0/b/social-app-8a28d.firebasestorage.app/o/default-avatar.png?alt=media&token=78165d2b-f095-496c-9de2-5e143bfc41cc";

  const canEditOrDeleteComment = (comment) => {
    if (!user) return false;
    if (user.isAdmin || user.isModerator) return true;
    return comment.uid === user.uid;
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    const newComment = {
      text: content.trim(),
      author: user.displayName || user.email || "Unknown User",
      uid: user.uid,
      role: user.role || "user",
      createdAt: new Date().toISOString(),
      likes: [],
      replies: [],
    };
    const postRef = doc(db, "posts", post.id);
    await updateDoc(postRef, { comments: [...(post.comments || []), newComment] });
    setContent("");
  };

  const handleDeleteComment = async (commentIndex) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    const postRef = doc(db, "posts", post.id);
    const updatedComments = [...post.comments];
    updatedComments.splice(commentIndex, 1);
    await updateDoc(postRef, { comments: updatedComments });
  };

  const saveEditedComment = async (commentIndex) => {
    if (!editContent.trim()) return;
    const postRef = doc(db, "posts", post.id);
    const updatedComments = [...post.comments];
    updatedComments[commentIndex] = {
      ...updatedComments[commentIndex],
      text: editContent.trim(),
      editedAt: serverTimestamp(),
    };
    await updateDoc(postRef, { comments: updatedComments });
    setEditingCommentId(null);
    setEditContent("");
  };

  const toggleLike = async (commentIndex) => {
    if (!user) return;
    const postRef = doc(db, "posts", post.id);
    const updatedComments = [...post.comments];
    const comment = updatedComments[commentIndex];
    if (comment.likes?.includes(user.uid)) {
      updatedComments[commentIndex] = {
        ...comment,
        likes: comment.likes.filter((uid) => uid !== user.uid),
      };
    } else {
      updatedComments[commentIndex] = {
        ...comment,
        likes: [...(comment.likes || []), user.uid],
      };
    }
    await updateDoc(postRef, { comments: updatedComments });
  };

  const handleAddReply = async (commentIndex, text) => {
    if (!user || !text.trim()) return;
    const postRef = doc(db, "posts", post.id);
    const updatedComments = [...post.comments];
    updatedComments[commentIndex] = {
      ...updatedComments[commentIndex],
      replies: [
        ...(updatedComments[commentIndex].replies || []),
        {
          text: text.trim(),
          author: user.displayName || user.email || "Unknown User",
          uid: user.uid,
          role: user.role || "user",
          createdAt: new Date().toISOString(),
          likes: [],
        },
      ],
    };
    await updateDoc(postRef, { comments: updatedComments });
  };

  return (
    <div className="mt-4">
      {/* Add Comment Form */}
      <form onSubmit={handleAddComment} className="flex flex-wrap gap-2 mb-4">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 min-w-[200px] p-2 border rounded"
        />
        <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded">
          Post
        </button>
      </form>

      {/* Comments List */}
      <div className="space-y-3">
        {post.comments.map((comment, index) => {
          const commentUser = usersMap[comment.uid] || {};
          const commentAvatar = commentUser.photoURL || DEFAULT_AVATAR;
          return (
            <div
              key={index}
              className="border p-2 rounded flex flex-wrap sm:flex-nowrap items-start gap-2"
            >
              <img
                src={commentAvatar}
                alt={comment.author}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                onClick={() => goToProfile(comment.uid)}
              />
              <div className="flex-1 break-words">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <strong className="cursor-pointer" onClick={() => goToProfile(comment.uid)}>
                    {commentUser.displayName || comment.author}
                    {commentUser.isAdmin && (
                      <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                    {commentUser.isModerator && (
                      <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">
                        Moderator
                      </span>
                    )}
                  </strong>
                  {comment.createdAt && (
                    <span className="text-xs text-gray-500">
                      {safeFormatDate(comment.createdAt)}
                    </span>
                  )}
                </div>

                {editingCommentId === index ? (
                  <>
                    <textarea
                      className="w-full p-2 border rounded my-1"
                      rows={3}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div className="space-x-2">
                      <button
                        onClick={() => saveEditedComment(index)}
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
                  <p>{comment.text}</p>
                )}

                <div className="mt-1 flex items-center gap-4 text-xs text-gray-600">
                  {/* Reply button */}
                  <button
                    onClick={() =>
                      setActiveReplyBox(activeReplyBox === index ? null : index)
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reply
                  </button>

                  {/* Like button */}
                  <button
                    onClick={() => toggleLike(index)}
                    className={`flex items-center gap-1 hover:underline ${
                      comment.likes?.includes(user?.uid)
                        ? "text-blue-600 font-semibold"
                        : "text-gray-600"
                    }`}
                  >
                    <ThumbsUp size={14} />
                    {comment.likes?.includes(user?.uid) ? "Liked" : "Like"}
                  </button>

                  {/* Like count */}
                  {comment.likes?.length > 0 && (
                    <span className="text-gray-500">
                      {comment.likes.length}{" "}
                      {comment.likes.length === 1 ? "Like" : "Likes"}
                    </span>
                  )}

                  {/* Edit/Delete */}
                  {canEditOrDeleteComment(comment) && editingCommentId !== index && (
                    <>
                      <button
                        onClick={() => {
                          setEditingCommentId(index);
                          setEditContent(comment.text);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteComment(index)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {/* Inline reply input */}
                {activeReplyBox === index && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const text = e.target.elements.replyText.value;
                      handleAddReply(index, text);
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

                {/* Nested Replies */}
                <HomeReplies
                  postId={post.id}
                  comment={post}
                  commentIndex={index}
                  commentUser={commentUser}
                  commentAvatar={commentAvatar}
                  user={user}
                  usersMap={usersMap}
                  goToProfile={goToProfile}
                  safeFormatDate={safeFormatDate}
                />;
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}