// Firefox runs MV3 background code as an event page, not a service worker,
// so importScripts() does not exist there. The Firefox manifest lists the
// imported files (background.js, moodle_queue.js) directly after
// background_worker.js, so the calls only need to be accepted as no-ops.
if (typeof self.importScripts !== 'function') {
    self.importScripts = function () {};
}
