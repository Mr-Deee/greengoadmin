'use client';

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from "./loginstyle.module.css";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;
      const snapshot = await get(ref(db, `Admin/${uid}`));
      const role = snapshot.val()?.role;

      switch (role) {
        case 'admin':
          router.push('/admin');
          break;
        case 'super_admin':
          router.push('/superadmin');
          break;
        case 'customer_service':
          router.push('/support');
          break;
        default:
          alert("Role not defined");
      }
    } catch (error) {
      alert("Login failed");
      console.error(error);
    }
  };



  const goToSignup = () => {
    router.push('/signup');
  };
  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <div className={styles.formSection}>
          <div className={styles.heading}>
            <span className={styles.icon}></span>
            <h2>GreenGoHub Admin</h2>
            <p>Please enter your details.</p>
          </div>

          <form onSubmit={handleLogin} className={styles.form}>
            <input
              type="email"
              placeholder="Email"
              required
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
            <input
              type="password"
              placeholder="Password"
              required
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
            />

            <div className={styles.options}>
              <label>
                <input type="checkbox" /> Remember for 30 days
              </label>
              <a href="#">Forgot password?</a>
            </div>

            <button type="submit" className={styles.loginButton}>Login</button>
            <div className={styles.newuser} onClick={goToSignup}>New User?Sign Up</div>
            <div className={styles.or}>or</div>

            <div className={styles.socialButtons}>
              <button type="button" className={styles.apple}></button>
              <button type="button" className={styles.social}>
                <Image src="/google.svg" alt="Google" width={20} height={20} />
              </button>
              <button type="button" className={styles.social}>
                <Image src="/facebook.svg" alt="Facebook" width={20} height={20} />
              </button>
            </div>
          </form>
        </div>

        <div className={styles.imageSection}>
          <Image
            src="/login-bg.jpg"
            alt="Login Visual"
            width={800}
            height={800}
            className={styles.loginImage}
          />
        </div>
      </div>
    </div>
  );
}
