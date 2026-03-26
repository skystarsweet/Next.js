import type { NextPage } from 'next'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import styles from '../styles/Home.module.css'

const WindowsAudioPlayer = dynamic(() => import('../components/WindowsAudioPlayer'), { ssr: false })

const Home: NextPage = () => {
  return (
    <div className={styles.desktop}>
      <Head>
        <title>Windows Audio Player</title>
        <meta name="description" content="Windows-style audio player built with Next.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.desktopMain}>
        <WindowsAudioPlayer />
      </main>
    </div>
  )
}

export default Home
