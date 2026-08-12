package com.survey.task;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

/**
 * 主页面Activity - WebView容器
 * 功能：全屏加载服务器网页，支持后退、刷新、文件选择
 */
public class MainActivity extends AppCompatActivity {

    // Intent参数键名
    public static final String EXTRA_SERVER_URL = "server_url";
    public static final String EXTRA_JWT_TOKEN = "jwt_token";

    // UI控件
    private SurveyWebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefreshLayout;
    private LinearLayout errorLayout;
    private Button btnRetry;

    // 数据
    private String serverUrl;
    private String jwtToken;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // 获取传递的参数
        Intent intent = getIntent();
        serverUrl = intent.getStringExtra(EXTRA_SERVER_URL);
        jwtToken = intent.getStringExtra(EXTRA_JWT_TOKEN);

        // 参数校验
        if (serverUrl == null || serverUrl.isEmpty()) {
            Toast.makeText(this, "服务器地址无效，请重新登录", Toast.LENGTH_LONG).show();
            navigateToLogin();
            return;
        }

        // 初始化视图
        initViews();

        // 配置WebView
        configureWebView();

        // 加载网页
        loadWebPage();
    }

    /**
     * 初始化视图控件
     */
    private void initViews() {
        webView = findViewById(R.id.web_view);
        progressBar = findViewById(R.id.progress_bar);
        swipeRefreshLayout = findViewById(R.id.swipe_refresh);
        errorLayout = findViewById(R.id.error_layout);
        btnRetry = findViewById(R.id.btn_retry);

        // 配置下拉刷新
        swipeRefreshLayout.setColorSchemeColors(
                getResources().getColor(R.color.colorPrimary, null),
                getResources().getColor(R.color.colorAccent, null)
        );
        swipeRefreshLayout.setOnRefreshListener(() -> {
            webView.reload();
        });

        // 重试按钮
        btnRetry.setOnClickListener(v -> {
            errorLayout.setVisibility(View.GONE);
            swipeRefreshLayout.setVisibility(View.VISIBLE);
            loadWebPage();
        });
    }

    /**
     * 配置WebView设置
     */
    private void configureWebView() {
        WebSettings settings = webView.getSettings();

        // 启用JavaScript
        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        // 缩放设置
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);

        // 自适应屏幕
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING);

        // 缓存设置 - 优先使用网络
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        // 文件访问
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // 混合内容允许（HTTP+HTTPS）
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // 设置WebViewClient
        webView.setWebViewClient(new SurveyWebViewClient());

        // 设置WebChromeClient用于进度条和文件选择
        webView.setWebChromeClient(new SurveyWebChromeClient());
    }

    /**
     * 加载网页 - 直接加载dashboard，通过cookie和JS注入token
     */
    private void loadWebPage() {
        // 先设置cookie，确保页面加载时能读取到token
        if (jwtToken != null && !jwtToken.isEmpty()) {
            String cookieStr = "auth_token=" + jwtToken + "; path=/";
            android.webkit.CookieManager.getInstance().setCookie(serverUrl, cookieStr);
        }

        // 直接加载dashboard.html，跳过index.html登录页
        String loadUrl = serverUrl + "/dashboard.html";
        webView.loadUrl(loadUrl);
    }

    /**
     * 处理后退键 - WebView内回退或退出确认
     */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            showExitDialog();
        }
    }

    /**
     * 显示退出确认对话框
     */
    private void showExitDialog() {
        new AlertDialog.Builder(this)
                .setTitle("退出应用")
                .setMessage("确定要退出应用吗？")
                .setPositiveButton("退出", (dialog, which) -> {
                    finishAffinity();
                })
                .setNegativeButton("取消", null)
                .show();
    }

    /**
     * 跳转到登录页面
     */
    private void navigateToLogin() {
        Intent intent = new Intent(MainActivity.this, LoginActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    /**
     * 自定义WebViewClient - 处理页面加载和错误
     */
    private class SurveyWebViewClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            String scheme = request.getUrl().getScheme();
            
            // 处理tel:链接 - 拨打电话
            if ("tel".equals(scheme)) {
                Intent dialIntent = new Intent(Intent.ACTION_DIAL, request.getUrl());
                startActivity(dialIntent);
                return true;
            }
            
            // 处理sms:链接 - 发送短信
            if ("sms".equals(scheme)) {
                Intent smsIntent = new Intent(Intent.ACTION_SENDTO, request.getUrl());
                startActivity(smsIntent);
                return true;
            }
            
            // 处理mailto:链接 - 发送邮件
            if ("mailto".equals(scheme)) {
                Intent emailIntent = new Intent(Intent.ACTION_SENDTO, request.getUrl());
                startActivity(emailIntent);
                return true;
            }
            
            // 处理geo:链接 - 打开地图应用
            if ("geo".equals(scheme)) {
                Intent mapIntent = new Intent(Intent.ACTION_VIEW, request.getUrl());
                startActivity(mapIntent);
                return true;
            }
            
            // 同域名页面在WebView内加载（不调用view.loadUrl，避免双重加载）
            if (url.startsWith(serverUrl)) {
                return false;
            }
            
            // 其他外部链接在系统浏览器中打开
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, request.getUrl());
            startActivity(browserIntent);
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            // 页面加载完成，停止刷新动画
            swipeRefreshLayout.setRefreshing(false);
            // 隐藏错误布局
            errorLayout.setVisibility(View.GONE);
            swipeRefreshLayout.setVisibility(View.VISIBLE);

            // 注入token到localStorage和cookie，确保网页自动登录
            if (jwtToken != null && !jwtToken.isEmpty()) {
                // 设置cookie
                String cookieStr = "auth_token=" + jwtToken + "; path=/";
                android.webkit.CookieManager.getInstance().setCookie(serverUrl, cookieStr);
                
                // 注入JavaScript设置localStorage token
                String js = "javascript:void(function(){" +
                    "if(!localStorage.getItem('token')){" +
                    "localStorage.setItem('token','" + jwtToken + "');" +
                    "}" +
                    "}())";
                view.evaluateJavascript(js, null);
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            // 只处理主框架的错误
            if (request.isForMainFrame()) {
                showErrorPage();
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request.isForMainFrame()) {
                showErrorPage();
            }
        }
    }

    /**
     * 显示错误页面
     */
    private void showErrorPage() {
        runOnUiThread(() -> {
            swipeRefreshLayout.setRefreshing(false);
            swipeRefreshLayout.setVisibility(View.GONE);
            errorLayout.setVisibility(View.VISIBLE);
        });
    }

    /**
     * 自定义WebChromeClient - 处理进度条和文件选择
     */
    private class SurveyWebChromeClient extends WebChromeClient {

        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            super.onProgressChanged(view, newProgress);
            if (newProgress == 100) {
                progressBar.setVisibility(View.GONE);
            } else {
                progressBar.setVisibility(View.VISIBLE);
                progressBar.setProgress(newProgress);
            }
        }

        // 文件选择回调
        @Override
        public boolean onShowFileChooser(WebView webView, android.webkit.ValueCallback<android.net.Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
            // 调用SurveyWebView的文件选择处理
            if (MainActivity.this.webView != null) {
                return MainActivity.this.webView.handleFileChooser(filePathCallback, fileChooserParams);
            }
            return false;
        }
    }
}
