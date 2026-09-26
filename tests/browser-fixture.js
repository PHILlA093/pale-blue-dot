// Loaded ONLY by tests/preview-server.py at /qa-train.html; not included in any product page/build.
(function () {
  'use strict';
  var listeners = [], mode = 'valid', calls = 0;
  localStorage.setItem('qg_ds_key', 'mock-fixture-not-a-real-key');
  localStorage.setItem('qg_live_state', JSON.stringify({ subject: 'math', subjectName: '高中数学', selName: '导数的概念', t: Date.now() }));
  var panel = document.createElement('div');
  panel.style.cssText = 'padding:8px;background:#263952;color:white;position:relative;z-index:10000';
  panel.textContent = '隔离测试:模拟 AI,不访问外部接口。';
  [['valid', '模拟正常返回'], ['network', '模拟连接失败'], ['invalid', '模拟无效题目']].forEach(function (item) {
    var button = document.createElement('button');
    button.textContent = item[1];
    button.onclick = function () { mode = item[0]; calls = 0; document.documentElement.setAttribute('data-qa-calls', '0'); };
    panel.appendChild(button);
  });
  document.querySelector('main').insertBefore(panel, document.querySelector('main').firstChild);
  window.chrome = window.chrome || {};
  window.chrome.webview = {
    addEventListener: function (name, callback) { if (name === 'message') listeners.push(callback); },
    postMessage: function (message) {
      if (!message._seq) return;
      var reply = { _seq: message._seq, ok: true, hits: [] };
      if (message.kind === 'ds') {
        calls++;
        document.documentElement.setAttribute('data-qa-calls', String(calls));
        document.documentElement.setAttribute('data-qa-model', message.model);
        if (mode === 'network') { reply.ok = false; reply.err = '模拟连接失败'; }
        else {
          var qs = [1, 2, 3, 4].map(function (n) {
            return { type: '单选', difficulty: 3, stem: '已知函数 $f(x)=x+' + n + '$,则 $f(0)$ 的值为多少?',
              options: ['A. ' + n, 'B. ' + (n + 1), 'C. ' + (n + 2), 'D. ' + (n + 3)], answer: 'A',
              analysis: '把 $x=0$ 代入,得 $f(0)=' + n + '$。', source: 'AI 生成', sourceId: '' };
          });
          reply.content = JSON.stringify({ questions: mode === 'invalid' ? [null, null, null, null] : qs });
        }
      }
      setTimeout(function () { listeners.forEach(function (callback) { callback({ data: reply }); }); }, 20);
    }
  };
})();
