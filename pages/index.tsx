import type { NextPage } from 'next'
import Head from 'next/head'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import styles from '../styles/Home.module.css'

const WindowsAudioPlayer = dynamic(() => import('../components/WindowsAudioPlayer'), { ssr: false })
const MacAudioPlayer = dynamic(() => import('../components/MacAudioPlayer'), { ssr: false })

const Home: NextPage = () => {
  const [active, setActive] = useState<'mac' | 'windows'>('mac')

  return (
    <div className={active === 'mac' ? styles.desktopMac : styles.desktopWindows}>
      <Head>
        <title>Audio Player</title>
        <meta name="description" content="macOS & Windows-style audio players" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.switcher}>
        <button
          className={`${styles.switchBtn} ${active === 'mac' ? styles.switchBtnActive : ''}`}
          onClick={() => setActive('mac')}
        >
           macOS
        </button>
        <button
          className={`${styles.switchBtn} ${active === 'windows' ? styles.switchBtnActive : ''}`}
          onClick={() => setActive('windows')}
        >
          🪟 Windows
        </button>
      </div>

      <main className={styles.desktopMain}>
        {active === 'mac' ? <MacAudioPlayer /> : <WindowsAudioPlayer />}
      </main>
    </div>
  )
}

export default Home
