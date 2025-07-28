import type { NextPage } from 'next';
import Head from 'next/head';
import { useState } from 'react';
import styles from '../styles/Home.module.css';

const AddPatient: NextPage = () => {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patientData = { name, dob, phone };
    await fetch('/api/add-patient', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientData),
    });
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Add Patient</title>
        <meta name="description" content="Add a new patient to the clinic database" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Add a New Patient
        </h1>

        <form onSubmit={handleSubmit} className={styles.grid}>
          <div className={styles.card}>
            <label htmlFor="name">Name:</label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className={styles.card}>
            <label htmlFor="dob">Date of Birth:</label>
            <input type="date" id="dob" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>

          <div className={styles.card}>
            <label htmlFor="phone">Phone:</label>
            <input type="tel" id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <button type="submit" className={styles.card}>
            <h2>Add Patient</h2>
          </button>
        </form>
      </main>
    </div>
  );
};

export default AddPatient;
