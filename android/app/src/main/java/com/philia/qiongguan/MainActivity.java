package com.philia.qiongguan;

import android.content.res.Configuration;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * 原生安全区桥(2026-10-01):把系统状态栏/导航栏的高度(px)注入页面
 * window.__qgInsets{top,bottom,left,right}。老 WebView 不支持
 * env(safe-area-inset-*) 时,页面(qlabm/页面级脚本)用 max(env(), 原生值)
 * 兜底,刘海/手势条/三键导航在两种路径下都有真实数值。
 * 注入点:onCreate(桥就绪后 post)+ 页面加载后的延迟重推 + 转屏。
 * ⚠ BridgeActivity 的 onStart/onResume/onPause/onStop/onDestroy 都是
 *   final,不能覆写 —— 生命周期里的重推靠 webview.postDelayed 兜底。
 */
public class MainActivity extends BridgeActivity {

  private void pushInsets() {
    try {
      final WebView wv = getBridge().getWebView();
      if (wv == null) return;
      final WindowInsetsCompat ins = WindowInsetsCompat.toWindowInsetsCompat(
          getWindow().getDecorView().getRootWindowInsets());
      if (ins == null) return;
      final Insets sb = ins.getInsets(WindowInsetsCompat.Type.statusBars());
      final Insets nb = ins.getInsets(WindowInsetsCompat.Type.navigationBars());
      final int top = sb.top;
      final int bottom = nb.bottom;
      final int left = Math.max(sb.left, nb.left);
      final int right = Math.max(sb.right, nb.right);
      wv.post(new Runnable() {
        @Override
        public void run() {
          String js = "window.__qgInsets={top:" + top + ",bottom:" + bottom +
              ",left:" + left + ",right:" + right + "};" +
              "if(window.__qgInsetsCb){window.__qgInsetsCb(window.__qgInsets);}";
          wv.evaluateJavascript(js, null);
        }
      });
    } catch (Throwable t) {
      /* 桥失败不致命:页面还有 env() 路径 */
    }
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    // ★ 白色状态栏带修复的关键一步:Capacitor 的 BridgeActivity 从不调用
    //   installSplashScreen,导致 styles.xml 里的 postSplashScreenTheme 永不生效
    //   —— 应用一直停在启动主题(窗口底=白色启动图)。这里按 androidx 要求
    //   **在 super.onCreate 之前**安装,启动图结束后即切换到正式主题(深色窗口底)。
    SplashScreen.installSplashScreen(this);
    super.onCreate(savedInstanceState);
    // ★ edge-to-edge(2026-10-01,白带根因二):API 34 默认窗口**不**伸到状态栏后面,
    //   透明状态栏后面露的是系统壁纸/浅色底 —— 这就是所有机型顶部的白带。
    //   这里让窗口铺满整屏:网页的 env(safe-area-inset-*) 与 window.__qgInsets
    //   才拿得到真实数值,顶部白带变成应用自己的深色底。
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    // 应用是深色底,状态栏图标用亮色(否则系统会按浅色主题画深色图标)
    try {
      WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
          .setAppearanceLightStatusBars(false);
    } catch (Throwable t) { /* 忽略 */ }
    pushInsets();
    // 页面加载完成后补推一次(BridgeActivity 的 onStart/onResume 是 final,
    // 只能靠延迟重推覆盖"首次布局后/加载完成"这个时机)
    try {
      final WebView wv = getBridge().getWebView();
      if (wv != null) {
        wv.postDelayed(new Runnable() {
          @Override public void run() { pushInsets(); }
        }, 1500);
        wv.postDelayed(new Runnable() {
          @Override public void run() { pushInsets(); }
        }, 4000);
      }
    } catch (Throwable t) { /* 忽略 */ }
  }

  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    pushInsets();
  }
}
