'use strict';
window.offlineStorage = (() => {
  let database;
  const ready = new Promise((resolve,reject) => {
    const request = indexedDB.open('demacia-rising-offline',1);
    request.onupgradeneeded = () => request.result.createObjectStore('profiles');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Đóng các tab game khác để mở bản lưu.'));
    request.onsuccess = () => {database=request.result; resolve();};
  });
  async function read() {
    await ready;
    return new Promise((resolve,reject) => {
      const request = database.transaction('profiles').objectStore('profiles').get('current');
      request.onsuccess = () => resolve(request.result ? OfflineProfile.validate(request.result) : OfflineProfile.fresh());
      request.onerror = () => reject(request.error);
    });
  }
  async function write(profile) {
    await ready;
    return new Promise((resolve,reject) => {
      const transaction = database.transaction('profiles','readwrite');
      transaction.objectStore('profiles').put(OfflineProfile.validate(profile),'current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Không thể lưu tiến trình.'));
    });
  }
  return {read,write};
})();
