import { useEffect, useState, Fragment, useRef } from "react";
import { createPortal } from "react-dom"; // Added for portal
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { getDownloadURL, ref } from "firebase/storage";
import { formatDistanceToNow } from "date-fns";
import { arrayUnion, arrayRemove } from "firebase/firestore";
import EmojiPicker from "emoji-picker-react"; // Added for emoji picker
import { ThumbsUp, X } from "lucide-react"; // Added X for close button
import GroupReplies from "./GroupReplies";
import { useGroupPermissions } from "../../hooks/useGroupPermissions";
import RoleBadge from "./RoleBadge";

export default function GroupComments({ postId, currentUser, groupId }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [activeReplyBox, setActiveReplyBox] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null); // State for emoji picker (both comment and reply)
  const commentInputRef = useRef(null); // Ref for comment input
  const replyInputRef = useRef(null); // Ref for reply input

  // Group permissions
  const {
    canEditContent,
    canDeleteContent,
    getUserRole,
    isMember
  } = useGroupPermissions(groupId, currentUser?.uid);

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

  useEffect(() => {
    if (!postId) return;

    const q = query(
      collection(db, "groupComments"),
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Always ensure we have an avatar + likes
      const updated = await Promise.all(
        docs.map(async (c) => {
          if (c.uid) {
            const userDoc = await getDoc(doc(db, "users", c.uid));
            if (userDoc.exists()) {
              return {
                ...c,
                authorPhotoURL: userDoc.data().photoURL || DEFAULT_AVATAR,
                likes: c.likes || [],
              };
            }
          }
          return { ...c, authorPhotoURL: DEFAULT_AVATAR, likes: c.likes || [] };
        })
      );

      setComments(updated);
    });

    return () => unsub();
  }, [postId, DEFAULT_AVATAR]);

  const canEditOrDeleteComment = (comment) => {
    if (!currentUser) return false;
    // Use group permissions for edit/delete checks
    return canEditContent(comment.uid) || canDeleteContent(comment.uid);
  };

  const formatCommentDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true })
        .replace("about ", "")
        .replace("minutes ago", "mins ago")
        .replace("minute ago", "min ago");
    } catch (err) {
      console.error("Error formatting date:", err);
      return "";
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!content.trim() || !currentUser || !isMember) return;
    
    try {
      await addDoc(collection(db, "groupComments"), {
        postId,
        uid: currentUser.uid,
        author: currentUser.displayName,
        authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR,
        content: content.trim(),
        createdAt: serverTimestamp(),
        likes: [],
        groupId: groupId // Add groupId for permission tracking
      });
      setContent("");
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment. Please try again.");
    }
  };

  const handleDeleteComment = async (commentId, authorId) => {
    if (!canDeleteContent(authorId)) {
      alert("You don't have permission to delete this comment.");
      return;
    }
    
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    
    try {
      await deleteDoc(doc(db, "groupComments", commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Failed to delete comment. Please try again.");
    }
  };

  const saveEditedComment = async () => {
    if (!editContent.trim()) return;
    
    try {
      await updateDoc(doc(db, "groupComments", editingCommentId), {
        content: editContent.trim(),
        editedAt: serverTimestamp(),
      });
      setEditingCommentId(null);
      setEditContent("");
    } catch (error) {
      console.error("Error editing comment:", error);
      alert("Failed to edit comment. Please try again.");
    }
  };

  const toggleLike = async (comment) => {
    if (!currentUser) return;
    const commentRef = doc(db, "groupComments", comment.id);
    try {
      if (comment.likes?.includes(currentUser.uid)) {
        await updateDoc(commentRef, {
          likes: arrayRemove(currentUser.uid),
        });
      } else {
        await updateDoc(commentRef, {
          likes: arrayUnion(currentUser.uid),
        });
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  const handleAddReply = async (parentCommentId, text) => {
    if (!currentUser || !text.trim() || !isMember) return;
    try {
      await addDoc(collection(db, "groupReplies"), {
        commentId: parentCommentId,
        parentReplyId: null,
        uid: currentUser.uid,
        author: currentUser.displayName,
        authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR,
        content: text.trim(),
        createdAt: serverTimestamp(),
        likes: [],
        groupId: groupId // Add groupId for permission tracking
      });
    } catch (err) {
      console.error("Error adding reply:", err);
      alert("Failed to add reply. Please try again.");
    }
  };

  const handleEmojiClick = (emojiObject, inputType, commentId = null) => {
    if (inputType === "comment") {
      setContent((prev) => prev + emojiObject.emoji);
    } else if (inputType === "reply") {
      setReplyText((prev) => prev + emojiObject.emoji);
    }
    setShowEmojiPicker(null); // Close picker after selection
  };

  const [replyText, setReplyText] = useState(""); // State for controlled reply input

  return (
    <div className="mt-4">
      {/* Add Comment Form */}
      {currentUser && isMember ? (
        <form
          onSubmit={handleAddComment}
          className="flex flex-wrap gap-2 mb-4 relative"
        >
          <div className="flex items-center w-full relative">
            <input
              ref={commentInputRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 min-w-[200px] p-2 pr-10 border rounded"
              maxLength={1000}
            />
            <button
              type="button"
              onClick={() =>
                setShowEmojiPicker(
                  showEmojiPicker === "comment" ? null : "comment"
                )
              }
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              😊
            </button>
          </div>
          {showEmojiPicker === "comment" &&
            createPortal(
              <div
                className="absolute z-50"
                style={{
                  top: commentInputRef.current
                    ? commentInputRef.current.getBoundingClientRect().bottom +
                      window.scrollY +
                      2
                    : "auto",
                  right: commentInputRef.current
                    ? window.innerWidth -
                      commentInputRef.current.getBoundingClientRect().right
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
                      handleEmojiClick(emojiObject, "comment")
                    }
                  />
                </div>
              </div>,
              document.body
            )}
          <button
            type="submit"
            disabled={!content.trim()}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Post
          </button>
        </form>
      ) : !currentUser ? (
        <div className="mb-4 p-3 bg-gray-50 rounded text-center">
          <p className="text-gray-600">Please log in to comment</p>
        </div>
      ) : !isMember ? (
        <div className="mb-4 p-3 bg-yellow-50 rounded text-center">
          <p className="text-gray-600">You must be a member of this group to comment</p>
        </div>
      ) : null}

      {/* Comments List */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="border p-2 rounded flex flex-wrap sm:flex-nowrap items-start gap-2"
          >
            <img
              src={comment.authorPhotoURL || DEFAULT_AVATAR}
              alt={comment.author}
              className="w-8 h-8 border-2 border-white rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 break-words">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <strong>{comment.author}</strong>
                  <RoleBadge role={getUserRole ? getUserRole(comment.uid) : null} size="xs" />
                </div>
                {comment.createdAt && (
                  <span className="text-xs text-gray-500">
                    {formatCommentDate(comment.createdAt)}
                    {comment.editedAt && " (edited)"}
                  </span>
                )}
              </div>

              {editingCommentId === comment.id ? (
                <>
                  <textarea
                    className="w-full p-2 border rounded my-1"
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    maxLength={1000}
                  />
                  <div className="space-x-2">
                    <button
                      onClick={saveEditedComment}
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
                <p>{comment.content}</p>
              )}

              <div className="mt-1 flex items-center gap-4 text-xs text-gray-600">
                {/* Reply button - Only for members */}
                {isMember && (
                  <button
                    onClick={() =>
                      setActiveReplyBox(
                        activeReplyBox === comment.id ? null : comment.id
                      )
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Reply
                  </button>
                )}

                <button
                  onClick={() => toggleLike(comment)}
                  disabled={!currentUser}
                  className={`flex items-center gap-1 hover:underline disabled:opacity-50 disabled:cursor-not-allowed ${
                    comment.likes?.includes(currentUser?.uid)
                      ? "text-blue-600 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  <ThumbsUp size={14} />
                  {comment.likes?.includes(currentUser?.uid) ? "Liked" : "Like"}
                </button>

                {comment.likes?.length > 0 && (
                  <span className="text-gray-500">
                    {comment.likes.length}{" "}
                    {comment.likes.length === 1 ? "Like" : "Likes"}
                  </span>
                )}

                {/* Edit/Delete - Based on group permissions */}
                {canEditOrDeleteComment(comment) &&
                  editingCommentId !== comment.id && (
                    <>
                      {canEditContent(comment.uid) && (
                        <button
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            setEditContent(comment.content);
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                      {canDeleteContent(comment.uid) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id, comment.uid)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
              </div>

              {/* Inline reply input - Only for members */}
              {activeReplyBox === comment.id && isMember && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddReply(comment.id, replyText);
                    setActiveReplyBox(null);
                    setReplyText("");
                    setShowEmojiPicker(null);
                  }}
                  className="flex flex-wrap gap-2 mt-2 relative"
                >
                  <div className="flex items-center w-full relative">
                    <input
                      ref={replyInputRef}
                      name="replyText"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 min-w-[150px] p-2 pr-10 border rounded text-sm"
                      maxLength={1000}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowEmojiPicker(
                          showEmojiPicker === `reply-${comment.id}`
                            ? null
                            : `reply-${comment.id}`
                        )
                      }
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      😊
                    </button>
                  </div>
                  {showEmojiPicker === `reply-${comment.id}` &&
                    createPortal(
                      <div
                        className="absolute z-50"
                        style={{
                          top: replyInputRef.current
                            ? replyInputRef.current.getBoundingClientRect().bottom +
                              window.scrollY +
                              2
                            : "auto",
                          right: replyInputRef.current
                            ? window.innerWidth -
                              replyInputRef.current.getBoundingClientRect().right
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
                              handleEmojiClick(emojiObject, "reply", comment.id)
                            }
                          />
                        </div>
                      </div>,
                      document.body
                    )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-3 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-800 transition-colors"
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
                      className="px-3 py-2 bg-gray-400 text-white rounded text-sm hover:bg-gray-500 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Nested Replies */}
              <GroupReplies
                commentId={comment.id}
                currentUser={currentUser}
                groupId={groupId}
                DEFAULT_AVATAR={DEFAULT_AVATAR}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}