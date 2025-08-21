import { useEffect, useState } from "react";
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

export default function GroupReplies({
  commentId,
  parentReplyId = null,
  currentUser,
  isAdmin,
  isModerator,
  DEFAULT_AVATAR,
  depth = 0, // ✅ track depth
}) {
  const [replies, setReplies] = useState([]);
  const [showReplies, setShowReplies] = useState(parentReplyId === null);
  const [visibleReplies, setVisibleReplies] = useState(3);

  useEffect(() => {
    if (!commentId) return;

    const q = query(
      collection(db, "groupReplies"),
      where("commentId", "==", commentId),
      where("parentReplyId", "==", parentReplyId),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const updated = await Promise.all(
        docs.map(async (reply) => {
          if (reply.uid) {
            const userDoc = await getDoc(doc(db, "users", reply.uid));
            if (userDoc.exists()) {
              return {
                ...reply,
                authorPhotoURL: userDoc.data().photoURL || DEFAULT_AVATAR,
              };
            }
          }
          return { ...reply, authorPhotoURL: DEFAULT_AVATAR };
        })
      );

      setReplies(updated);
    });

    return () => unsub();
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

  const handleToggleVisibility = () => {
    setVisibleReplies((prevVisible) =>
      prevVisible === 3 ? replies.length : 3
    );
  };

  if (replies.length === 0) return null;

  if (parentReplyId !== null && !showReplies) {
    return (
      <div className={depth === 0 ? "ml-3 mt-2" : "ml-0 mt-2"}>
        <button
          onClick={() => setShowReplies(true)}
          className="text-blue-500 text-xs hover:underline"
        >
          View {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </button>
      </div>
    );
  }

  return (
    <div className={depth === 0 ? "ml-3 mt-2" : "ml-0 mt-2"}>
      {parentReplyId !== null && (
        <button
          onClick={() => setShowReplies(false)}
          className="text-gray-500 text-xs hover:underline mb-2"
        >
          Hide replies
        </button>
      )}

      <div className="space-y-2">
        {replies
          .slice(0, Math.min(visibleReplies, replies.length))
          .map((reply) => (
            <SingleReply
              key={reply.id}
              reply={reply}
              commentId={commentId}
              currentUser={currentUser}
              isAdmin={isAdmin}
              isModerator={isModerator}
              DEFAULT_AVATAR={DEFAULT_AVATAR}
              canEditOrDelete={canEditOrDelete}
              formatReplyDate={formatReplyDate}
              depth={depth + 1} // ✅ increase depth
            />
          ))}

        {replies.length > 3 && (
          <div className="mt-2">
            <button
              onClick={handleToggleVisibility}
              className="text-blue-500 text-xs hover:underline font-medium"
            >
              {visibleReplies >= replies.length
                ? "Show less"
                : `View ${replies.length - visibleReplies} more replies`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SingleReply({
  reply,
  commentId,
  currentUser,
  isAdmin,
  isModerator,
  DEFAULT_AVATAR,
  canEditOrDelete,
  formatReplyDate,
  depth,
}) {
  const [editReplyId, setEditReplyId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");

  const handleUpdateReply = async (e) => {
    e.preventDefault();
    if (!editContent.trim()) return;
    await updateDoc(doc(db, "groupReplies", editReplyId), {
      content: editContent.trim(),
      editedAt: serverTimestamp(),
    });
    setEditReplyId(null);
    setEditContent("");
  };

  const handleAddReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    await addDoc(collection(db, "groupReplies"), {
      commentId,
      parentReplyId: reply.id,
      uid: currentUser.uid,
      author: currentUser.displayName,
      authorPhotoURL: currentUser.photoURL || DEFAULT_AVATAR,
      content: replyContent.trim(),
      createdAt: serverTimestamp(),
    });

    setReplyContent("");
    setShowReplyForm(false);
  };

  const startEdit = () => {
    setEditReplyId(reply.id);
    setEditContent(reply.content);
  };

  const cancelEdit = () => {
    setEditReplyId(null);
    setEditContent("");
  };

  const deleteReply = async () => {
    if (window.confirm("Delete this reply?")) {
      await deleteDoc(doc(db, "groupReplies", reply.id));
    }
  };

  return (
    <div className="border border-gray-200 p-2 rounded text-sm bg-white">
      <div className="flex items-start gap-2">
        <img
          src={reply.authorPhotoURL || DEFAULT_AVATAR}
          alt={reply.author}
          className="w-6 h-6 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 break-words">
          <div className="flex flex-wrap items-center gap-2 mb-1">
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
                className="w-full p-1 border rounded text-sm mb-2"
                autoFocus
              />
              <div className="space-x-2">
                <button
                  type="submit"
                  className="px-2 py-1 bg-green-600 text-white rounded text-xs"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-2 py-1 bg-gray-400 text-white rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-1 text-sm">{reply.content}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {currentUser && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-blue-500 hover:underline"
              >
                {showReplyForm ? "Cancel" : "Reply"}
              </button>
            )}

            {canEditOrDelete(reply) && editReplyId !== reply.id && (
              <>
                <button
                  onClick={startEdit}
                  className="text-blue-500 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={deleteReply}
                  className="text-red-500 hover:underline"
                >
                  Delete
                </button>
              </>
            )}
          </div>

          {showReplyForm && (
            <form
              onSubmit={handleAddReply}
              className="mt-2 p-2 bg-gray-50 rounded"
            >
              <input
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="w-full p-1 border rounded text-sm mb-2"
                autoFocus
              />
              <div className="space-x-2">
                <button
                  type="submit"
                  className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent("");
                  }}
                  className="px-2 py-1 bg-gray-400 text-white rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ✅ Keep replies to replies aligned under the first reply */}
          <GroupReplies
            commentId={commentId}
            parentReplyId={reply.id}
            currentUser={currentUser}
            isAdmin={isAdmin}
            isModerator={isModerator}
            DEFAULT_AVATAR={DEFAULT_AVATAR}
            depth={depth} // no extra indent after first level
          />
        </div>
      </div>
    </div>
  );
}