/* ============================================================
 * pwa.js — 注册 Service Worker(可选增强,失败绝不影响主流程)
 * ------------------------------------------------------------
 * 为什么单独一个文件而不是内联:
 *   三页(index/train/guanlan)共用同一段逻辑,内联要抄三份;
 *   且 CSP 已放行 'self',外部文件更干净。
 *
 * 注意:只有「安全上下文」(https 或 localhost)才允许注册 Service Worker。
 *   手机用 http://<局域网IP>:8080 访问时属于非安全上下文,register() 会抛错,
 *   这里全部吞掉,页面功能不受任何影响(只是没有离线缓存)。
 *   在 Capacitor APK(https://localhost)与电脑 127.0.0.1 自测时正常注册。
 * 结果写在 window.__qgSW 里,便于验收脚本读取,不往控制台打日志。
 * ============================================================ */
(function () {
  'use strict';
  window.__qgSW = 'unsupported';
  if (!('serviceWorker' in navigator)) return;
  // 非安全上下文先判掉,避免无谓的异常
  try {
    if (!window.isSecureContext) { window.__qgSW = 'insecure-context'; return; }
  } catch (e) { /* 忽略 */ }

  function reg() {
    try {
      navigator.serviceWorker.register('sw.js').then(function () {
        window.__qgSW = 'registered';
      }, function (e) {
        window.__qgSW = 'failed:' + ((e && e.name) || 'error');
      });
    } catch (e) {
      window.__qgSW = 'threw';
    }
  }
  if (document.readyState === 'complete') reg();
  else window.addEventListener('load', reg);
})();
