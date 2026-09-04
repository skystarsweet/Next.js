/// Well-known apps and their bundle identifiers, offered as one-tap presets.
class CatalogEntry {
  const CatalogEntry(this.displayName, this.bundleIdentifier);

  final String displayName;
  final String bundleIdentifier;
}

const List<CatalogEntry> appCatalog = [
  CatalogEntry('Safari', 'com.apple.mobilesafari'),
  CatalogEntry('Messages', 'com.apple.MobileSMS'),
  CatalogEntry('Mail', 'com.apple.mobilemail'),
  CatalogEntry('App Store', 'com.apple.AppStore'),
  CatalogEntry('Apple Music', 'com.apple.Music'),
  CatalogEntry('Apple TV', 'com.apple.tv'),
  CatalogEntry('YouTube', 'com.google.ios.youtube'),
  CatalogEntry('Google Chrome', 'com.google.chrome.ios'),
  CatalogEntry('Gmail', 'com.google.Gmail'),
  CatalogEntry('Google Maps', 'com.google.Maps'),
  CatalogEntry('Instagram', 'com.burbn.instagram'),
  CatalogEntry('Facebook', 'com.facebook.Facebook'),
  CatalogEntry('Messenger', 'com.facebook.Messenger'),
  CatalogEntry('WhatsApp', 'net.whatsapp.WhatsApp'),
  CatalogEntry('TikTok', 'com.zhiliaoapp.musically'),
  CatalogEntry('Snapchat', 'com.toyopagroup.picaboo'),
  CatalogEntry('X', 'com.atebits.Tweetie2'),
  CatalogEntry('Reddit', 'com.reddit.Reddit'),
  CatalogEntry('Pinterest', 'pinterest'),
  CatalogEntry('Telegram', 'ph.telegra.Telegraph'),
  CatalogEntry('Discord', 'com.hammerandchisel.discord'),
  CatalogEntry('Netflix', 'com.netflix.Netflix'),
  CatalogEntry('Spotify', 'com.spotify.client'),
  CatalogEntry('Twitch', 'tv.twitch'),
  CatalogEntry('Amazon', 'com.amazon.Amazon'),
];

/// Returns the catalog display name for [bundleIdentifier], or null.
String? catalogNameFor(String bundleIdentifier) {
  final lower = bundleIdentifier.toLowerCase();
  for (final entry in appCatalog) {
    if (entry.bundleIdentifier.toLowerCase() == lower) return entry.displayName;
  }
  return null;
}
