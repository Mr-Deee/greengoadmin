'use client';

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import styles from './signupstyle.module.css'; // Import modular styles
import { useRouter } from 'next/navigation';

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer_service');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;
      await set(ref(db, `Admin/${user.uid}`), {
        email,
        role,
      });
      alert("User created successfully");
      router.push('/login'); // Navigate to login page

    } catch (error) {
      alert("Error signing up");
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSignup} className={styles.signupContainer}>
      <input
        type="email"
        placeholder="Email"
        onChange={e => setEmail(e.target.value)}
        required
        className={styles.signupInput}
      />
      <input
        type="password"
        placeholder="Password"
        onChange={e => setPassword(e.target.value)}
        required
        className={styles.signupInput}
      />
      <select
        onChange={e => setRole(e.target.value)}
        className={styles.signupSelect}
      >
        <option value="admin">Admin</option>
        <option value="super_admin">Super Admin</option>
        <option value="customer_service">Customer Service</option>
        {/* Add more roles */}
      </select>
      <button type="submit" className={styles.signupButton}>Sign Up</button>
    </form>
  );
}
