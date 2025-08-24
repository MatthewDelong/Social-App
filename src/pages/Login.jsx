import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../components/ui/input';
import Button from '../components/ui/button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      alert('Please enter your email address');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
      alert('Password reset email sent! Check your inbox.');
    } catch (err) {
      alert(`Error sending reset email: ${err.message}`);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4 border rounded shadow">
      <h1 className="text-2xl font-bold mb-6">Log In</h1>
      
      {/* Login Form */}
      <Input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button onClick={handleLogin}>Log In</Button>

      {/* Forgot Password Link */}
      <p className="mt-4 text-sm text-center">
        <button
          onClick={() => setIsResetting(!isResetting)}
          className="text-blue-500 hover:underline"
        >
          Forgot your password?
        </button>
      </p>

      {/* Password Reset Form */}
      {isResetting && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h2 className="text-lg font-semibold mb-3">Reset Password</h2>
          <p className="text-sm text-gray-600 mb-3">
            Enter your email address and we'll send you a link to reset your password.
          </p>
          
          <Input
            placeholder="Enter your email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            className="mb-3"
          />
          
          <div className="flex gap-2">
            <Button 
              onClick={handlePasswordReset}
              disabled={resetSent}
            >
              {resetSent ? 'Email Sent' : 'Send Reset Link'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsResetting(false);
                setResetSent(false);
                setResetEmail('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Sign Up Link */}
      <p className="mt-4 text-sm">
        Don't have an account?{' '}
        <Link to="/signup" className="text-blue-500 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}