import type { NextPage } from 'next'
import Head from 'next/head'
import styles from '../styles/Home.module.css'

const channels = [
  {
    name: 'City Beats Live',
    genre: 'Music · Live DJ',
    viewers: '18.4K watching',
  },
  {
    name: 'Galactic News',
    genre: 'World · 24/7',
    viewers: '42.1K watching',
  },
  {
    name: 'Northshore Sports',
    genre: 'Sports · Live',
    viewers: '9.8K watching',
  },
  {
    name: 'Moonlight Cinema',
    genre: 'Movies · Classics',
    viewers: '6.3K watching',
  },
  {
    name: 'Chef Studio',
    genre: 'Food · Daily',
    viewers: '4.9K watching',
  },
  {
    name: 'Cloud Nine Kids',
    genre: 'Family · Cartoons',
    viewers: '3.7K watching',
  },
]

const categories = [
  'Top Picks',
  'Trending',
  'Live Sports',
  'News',
  'Movies',
  'Reality',
  'Lifestyle',
  'Kids',
]

const continueWatching = [
  {
    title: 'The Neon Hour',
    detail: 'S2 · Episode 4 · 18 min left',
  },
  {
    title: 'Storm Watch Live',
    detail: 'Breaking coverage · 42 min left',
  },
  {
    title: 'Street Eats',
    detail: 'S1 · Episode 9 · 12 min left',
  },
]

const Home: NextPage = () => {
  return (
    <div className={styles.page}>
      <Head>
        <title>Streamline TV</title>
        <meta name="description" content="Internet TV app experience" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <header className={styles.header}>
        <div className={styles.brand}>Streamline TV</div>
        <nav className={styles.nav}>
          <button className={styles.navButton}>Live</button>
          <button className={styles.navButton}>On Demand</button>
          <button className={styles.navButton}>Sports</button>
          <button className={styles.navButton}>Library</button>
        </nav>
        <div className={styles.headerActions}>
          <input
            className={styles.search}
            placeholder="Search channels, shows, or genres"
            aria-label="Search"
          />
          <button className={styles.primaryButton}>Go Live</button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <span className={styles.badge}>Featured Live</span>
            <h1 className={styles.heroTitle}>Aurora Nightline</h1>
            <p className={styles.heroDescription}>
              Stream the city skyline with real-time stories, curated music, and an always-on
              night show hosted by Skylar Lane.
            </p>
            <div className={styles.heroMeta}>
              <span>Live · 4K</span>
              <span>•</span>
              <span>42.5K watching</span>
              <span>•</span>
              <span>Updated every 5 min</span>
            </div>
            <div className={styles.heroActions}>
              <button className={styles.primaryButton}>Watch Now</button>
              <button className={styles.secondaryButton}>Add to Up Next</button>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.heroCard}>
              <p className={styles.heroCardTitle}>Up Next</p>
              <h3>Midnight Routes</h3>
              <span>Starts in 12 min</span>
              <div className={styles.heroCardProgress}>
                <div className={styles.heroCardFill} />
              </div>
              <button className={styles.ghostButton}>Remind Me</button>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Popular Channels</h2>
            <button className={styles.linkButton}>View all</button>
          </div>
          <div className={styles.channelGrid}>
            {channels.map((channel) => (
              <article key={channel.name} className={styles.channelCard}>
                <div className={styles.channelAvatar} />
                <div>
                  <h3>{channel.name}</h3>
                  <p>{channel.genre}</p>
                  <span>{channel.viewers}</span>
                </div>
                <button className={styles.ghostButton}>Watch</button>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}
        >
          <div className={styles.sectionHeader}>
            <h2>Browse by Category</h2>
            <button className={styles.linkButton}>Customize</button>
          </div>
          <div className={styles.categoryRow}>
            {categories.map((category) => (
              <span key={category} className={styles.categoryChip}>
                {category}
              </span>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Continue Watching</h2>
            <button className={styles.linkButton}>Manage</button>
          </div>
          <div className={styles.continueGrid}>
            {continueWatching.map((item) => (
              <article key={item.title} className={styles.continueCard}>
                <div className={styles.continuePreview} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
                <button className={styles.secondaryButton}>Resume</button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default Home
