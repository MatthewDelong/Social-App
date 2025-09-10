import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAppContext } from '../context/AppContext';
import { Image as ImageIcon, X as CloseIcon } from 'lucide-react';

const MAX_IMAGES_PER_POST = 4;
const TARGET_SIZE = 512;
const MAX_UPLOAD_BYTES = 1024 * 1024;

export default function NewPost() {
  const { user, theme } = useAppContext();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onFileChange = (e) => {
    const incoming = Array.from(e.target.files || []);
    if (incoming.length === 0) return;
    const remain = Math.max(0, MAX_IMAGES_PER_POST - files.length);
    const selected = incoming.slice(0, remain);
    const mapped = selected.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setFiles((prev) => [...prev, ...mapped]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles((prev) => {
      const arr = [...prev];
      const [rm] = arr.splice(index, 1);
      if (rm?.preview) URL.revokeObjectURL(rm.preview);
      return arr;
    });
  };

  useEffect(() => {
    return () => {
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    };
  }, [files]);

  const resizeToSquare512 = async (file) => {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(TARGET_SIZE / img.width, TARGET_SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const dx = (TARGET_SIZE - w) / 2;
    const dy = (TARGET_SIZE - h) / 2;
    ctx.drawImage(img, dx, dy, w, h);
    URL.revokeObjectURL(img.src);

    let quality = 0.92;
    let blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
      quality -= 0.08;
      blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) {
      quality = 0.9;
      blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
      while (blob && blob.size > MAX_UPLOAD_BYTES && quality > 0.5) {
        quality -= 0.08;
        blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
      }
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error('Image exceeds 1 MB after compression');
    return blob;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert('Please log in');
    if (!content.trim() && files.length === 0) return alert('Write something or add a photo');

    setUploading(true);
    setProgress(0);
    try {
      const docRef = await addDoc(collection(db, 'posts'), {
        uid: user.uid,
        author: user.displayName || user.email || 'Unknown User',
        content: content.trim(),
        createdAt: serverTimestamp(),
        likes: [],
        comments: [],
        images: [],
      });
      const id = docRef.id;

      if (files.length > 0) {
        const blobs = [];
        let total = 0;
        for (let i = 0; i < files.length; i++) {
          const b = await resizeToSquare512(files[i].file);
          blobs.push({ blob: b, name: files[i].file.name });
          total += b.size;
        }
        let transferred = 0;
        const uploaded = [];
        for (let i = 0; i < blobs.length; i++) {
          const { blob, name } = blobs[i];
          const path = `posts/${id}/${Date.now()}-${i}-${name.replace(/[^a-zA-Z0-9_.-]/g, '_')}.webp`;
          const sref = storageRef(storage, path);
          const task = uploadBytesResumable(sref, blob, { contentType: blob.type || 'image/webp' });
          await new Promise((resolve, reject) => {
            task.on('state_changed', (snap) => {
              const delta = snap.bytesTransferred - (snap._last || 0);
              snap._last = snap.bytesTransferred;
              transferred += delta;
              setProgress(Math.min(100, Math.round((transferred / total) * 100)));
            }, reject, async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              uploaded.push({ url, path, w: TARGET_SIZE, h: TARGET_SIZE });
              resolve();
            });
          });
        }
        if (uploaded.length > 0) await updateDoc(doc(db, 'posts', id), { images: uploaded });
      }

      navigate('/', { state: { scrollToPostId: id } });
    } catch (e) {
      alert(e?.message || 'Failed to create post');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const cols = files.length <= 1 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <div className="max-w-xl mx-auto mt-10" style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}>
      <form onSubmit={handleSubmit} className="border p-4 rounded bg-white/90">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full border rounded p-3 min-h-[120px]"
        />

        {files.length > 0 && (
          <div className={`mt-3 grid ${cols} gap-2`}>
            {files.map((f, idx) => (
              <div key={idx} className="relative">
                <img src={f.preview} alt="preview" className="w-full aspect-square object-cover rounded" />
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
                >
                  <CloseIcon size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <input id="newpost-file" type="file" className="hidden" multiple accept="image/*" onChange={(e) => onFileChange(e)} />
          <button
            type="button"
            onClick={() => document.getElementById('newpost-file')?.click()}
            disabled={files.length >= MAX_IMAGES_PER_POST}
            className="text-sm inline-flex items-center gap-1 disabled:opacity-50"
          >
            <ImageIcon size={16} className="text-gray-700" />
            {files.length >= MAX_IMAGES_PER_POST ? `Max ${MAX_IMAGES_PER_POST}` : 'Add photos'}
          </button>

          <button
            type="submit"
            disabled={uploading}
            className="ml-auto bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {uploading ? `Posting ${progress}%` : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
