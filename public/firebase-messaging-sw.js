/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBHM_Mr0u_B70uYPkeocLq-ReMgFUjLcuM',
  authDomain: 'montaogps-818c0.firebaseapp.com',
  projectId: 'montaogps-818c0',
  storageBucket: 'montaogps-818c0.firebasestorage.app',
  messagingSenderId: '314989110457',
  appId: '1:314989110457:web:5dc3f89b236b73034ea768',
  measurementId: 'G-NQET0H0HPS',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const notificationTitle =
    payload.data?.title || payload.notification?.title || 'Notificación';
  const notificationOptions = {
    body: payload.data?.body || payload.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
  const notificationType = event.notification?.data?.type;
  const route = event.notification?.data?.route;
  event.notification.close();
  if (notificationType !== 'conversation_reminder_buzz' || !route) return;

  const targetUrl = new URL(route, self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async function (windowClients) {
        const existingClient = windowClients.find(function (client) {
          return client.url.startsWith(self.location.origin);
        });
        if (existingClient) {
          await existingClient.navigate(targetUrl);
          return existingClient.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
