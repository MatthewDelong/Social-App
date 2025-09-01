import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, reload } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../components/ui/input';
import Button from '../components/ui/button';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function Signup() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const passwordsMatch = password && confirm && password === confirm;

  const handleSignup = async () => {
    const name = displayName.trim();
    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }
    if (!name) {
      setError('Please enter a display name');
      return;
    }
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          displayName: name,
          email,
          photoURL: user.photoURL || '',
          bannerURL: '',
          bio: '',
          location: '',
          website: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await reload(user);

      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url('/images/login&signup.png')` }}
    >
      <div className="w-full max-w-md bg-white/90 backdrop-blur-sm p-6 md:p-8 rounded-xl shadow-2xl border border-white/20 mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center text-gray-800">Sign Up</h1>

        <div className="space-y-4">
          <Input
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 text-base"
          />

          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 text-base"
          />

          <div className="relative">
            <Input
              type={showPwd ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-base pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
            >
              {showPwd ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
          </div>

          <div className="relative">
            <Input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 text-base pr-12"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
            >
              {showConfirm ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </button>
          </div>

          {!passwordsMatch && confirm && (
            <p className="text-sm text-red-600">Passwords do not match</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <Button
          onClick={handleSignup}
          className="w-1/2 mx-auto block mt-6 py-0 text-base bg-blue-200 hover:bg-blue-700"
          disabled={!displayName || !email || !passwordsMatch}
        >
          Sign Up
        </Button>

        <p className="mt-6 text-sm text-center text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
