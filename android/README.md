# android/ —— 只跟踪"本轮白带修复"改到的原生文件

完整 Gradle 工程（build/ 产物、gradle wrapper、node_modules 等）**不入库**，只把与本次修复直接相关的
5 个文件按真实路径镜像进来，便于复现与追溯：

| 文件 | 本轮改了什么 |
|---|---|
| `app/src/main/java/.../MainActivity.java` | 补 `installSplashScreen()`（Capacitor 的 BridgeActivity 从不调用它 → `postSplashScreenTheme` 是死代码）+ `WindowCompat.setDecorFitsSystemWindows(false)` + 状态栏亮色图标 + `WindowInsets → window.__qgInsets` 桥 |
| `app/src/main/res/values/styles.xml` | `postSplashScreenTheme` 指向 `AppTheme.NoActionBar`；启动主题深色 |
| `app/src/main/res/values/colors.xml` | 新增 `#0A101F` 深色底 |
| `app/build.gradle` | `versionCode 17 → 18`（versionName 仍 2.5.2） |
| `app/src/main/AndroidManifest.xml` | 供对照（未改） |

验收证据：模拟器 qg34 实测正式界面顶部 y=0/5/15/30/100 = RGB(9,15,28) ≈ `#0A101F`（修复前是 RGB(250,250,250) 白带）。