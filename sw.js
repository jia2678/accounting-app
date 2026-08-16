// 极简记账 Service Worker
// 版本号更新时自动清理旧缓存
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `accounting-pwa-${CACHE_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ============ 安装：预缓存核心资源 ============
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] 部分资源缓存失败:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// ============ 激活：清理旧缓存 ============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// ============ 请求拦截：缓存优先，网络回退 ============
self.addEventListener('fetch', (event) => {
  // 仅处理 GET 请求
  if (event.request.method !== 'GET') return;

  // 跳过非 http(s) 协议（如 chrome-extension、data URI）
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) {
          // 命中缓存，后台静默更新
          fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, clone);
                });
              }
            })
            .catch(() => {});
          return cached;
        }
        // 未命中，走网络
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
            return response;
          })
          .catch(() => {
            // 离线且无缓存：返回离线兜底页
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// ============ 消息通信：接收更新指令 ============
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
