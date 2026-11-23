package moe.nyaneko.kotonoha

import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // 整页滚动时,WebView 自带的拉伸回弹会拉动整个视图(连同吸顶顶栏),CSS 的 overscroll-behavior 压不住。翻章由前端自己的进度卡片反馈
  override fun onWebViewCreate(webView: WebView) {
    webView.overScrollMode = View.OVER_SCROLL_NEVER
  }
}
