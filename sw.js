/* Service Worker — פתיחה אופליין מלאה של המתכנן.
   נתוני Hebcal ומזג האוויר נשמרים במטמון של האפליקציה עצמה (localStorage), לא כאן. */
const VERSION = 'v4.4.0';
const SHELL_CACHE = 'planner-shell-' + VERSION;
const FONT_CACHE  = 'planner-fonts-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      // addAll נכשל כולו אם קובץ אחד חסר — לכן כל קובץ נשמר בנפרד
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== FONT_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // קריאות API: רשת בלבד. כשל מטופל בקוד האפליקציה מול המטמון המקומי שלה.
  if (url.hostname.endsWith('hebcal.com') || url.hostname.endsWith('open-meteo.com')) return;

  // גופנים: מטמון-תחילה, כי הם לא משתנים
  if (url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')){
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(FONT_CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // ניווט: רשת-תחילה, ובכשל — הדף מהמטמון (כך שהאפליקציה נפתחת אופליין)
  if (req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // שאר קבצי האפליקציה: מטמון-תחילה עם רענון ברקע
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200){
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
