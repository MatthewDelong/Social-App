// src/components/groups/GroupComments.jsx
import { useEffect, useState } from "react";
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
import { ThumbsUp } from "lucide-react";
import GroupReplies from "./GroupReplies";

export default function GroupComments({ postId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [DEFAULT_AVATAR, setDEFAULT_AVATAR] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [activeReplyBox, setActiveReplyBox] = useState(null);

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
                authorPhotoURL:
                  userDoc.data().photoURL || DEFAULT_AVATAR,
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
    if (currentUser.isAdmin || currentUser.isModerator) return true;
    return comment.uid === currentUser.uid;
  };

  const formatCommentDate = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true }).replace("about ", "");
    } catch (err) {
      console.error("Error formatting date:", err);
      return "";
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    await addDoc(collection(db, "groupComments"), {
      postId,
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR,
      content: content.trim(),
      createdAt: serverTimestamp(),
      likes: [],
    });
    setContent("");
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    await deleteDoc(doc(db, "groupComments", commentId));
  };

  const saveEditedComment = async () => {
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "groupComments", editingCommentId), {
      content: editContent.trim(),
      editedAt: serverTimestamp(),
    });
    setEditingCommentId(null);
    setEditContent("");
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
    if (!currentUser || !text.trim()) return;
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
      });
    } catch (err) {
      console.error("Error adding reply:", err);
    }
  };

  return (
    <div className="mt-4">
      {/* Add Comment Form */}
      <form
        onSubmit={handleAddComment}
        className="flex flex-wrap gap-2 mb-4"
      >
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 min-w-[200px] p-2 border rounded"
        />
        <button
          type="submit"
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Post
        </button>
      </form>

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
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 break-words">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <strong>{comment.author}</strong>
                {comment.createdAt && (
                  <span className="text-xs text-gray-500">
                    {formatCommentDate(comment.createdAt)}
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
                {/* Reply button */}
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

                {/* Like button */}
                <button
                  onClick={() => toggleLike(comment)}
                  className={`flex items-center gap-1 hover:underline ${
                    comment.likes?.includes(currentUser?.uid)
                      ? "text-blue-600 font-semibold"
                      : "text-gray-600"
                  }`}
                >
                  <ThumbsUp size={14} />
                  {comment.likes?.includes(currentUser?.uid) ? "Liked" : "Like"}
                </button>

                {/* Like count */}
                {comment.likes?.length > 0 && (
                  <span className="text-gray-500">
                    {comment.likes.length}{" "}
                    {comment.likes.length === 1 ? "Like" : "Likes"}
                  </span>
                )}

                {/* Edit/Delete */}
                {canEditOrDeleteComment(comment) &&
                  editingCommentId !== comment.id && (
                    <>
                      <button
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditContent(comment.content);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </>
                  )}
              </div>

              {/* Inline reply input */}
              {activeReplyBox === comment.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = e.target.elements.replyText.value;
                    handleAddReply(comment.id, text);
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
              <GroupReplies
                commentId={comment.id}
                currentUser={currentUser}
                isAdmin={currentUser?.isAdmin}
                isModerator={currentUser?.isModerator}
                DEFAULT_AVATAR={DEFAULT_AVATAR}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
