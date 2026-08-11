package com.survey.task;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.AttributeSet;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;

/**
 * 自定义WebView
 * 功能：支持文件选择（图片上传等）、JS桥接
 */
public class SurveyWebView extends WebView {

    // 文件选择请求码
    private static final int FILE_CHOOSER_REQUEST_CODE = 10001;

    // 文件选择回调
    private ValueCallback<Uri[]> filePathCallback;
    private WebChromeClient.FileChooserParams fileChooserParams;

    /**
     * 构造函数
     */
    public SurveyWebView(Context context) {
        super(context);
        init();
    }

    public SurveyWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    public SurveyWebView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    /**
     * 初始化WebView设置
     */
    private void init() {
        // 可以在这里添加自定义初始化逻辑
        setFocusable(true);
        setFocusableInTouchMode(true);
    }

    /**
     * 处理文件选择请求
     * 当网页中的input[type=file]被点击时调用
     * @param callback 文件路径回调
     * @param params 文件选择参数
     * @return 是否处理了文件选择
     */
    public boolean handleFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        // 保存回调引用
        this.filePathCallback = callback;
        this.fileChooserParams = params;

        try {
            // 创建文件选择Intent
            Intent intent = params.createIntent();
            if (getContext() instanceof Activity) {
                ((Activity) getContext()).startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
            }
            return true;
        } catch (Exception e) {
            // 如果创建Intent失败，取消回调
            if (callback != null) {
                callback.onReceiveValue(null);
            }
            return false;
        }
    }

    /**
     * 处理文件选择结果
     * 需要在Activity的onActivityResult中调用此方法
     * @param requestCode 请求码
     * @param resultCode 结果码
     * @param data 返回的数据
     * @return 是否处理了该结果
     */
    public boolean handleActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (data.getClipData() != null) {
                        // 多文件选择
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return true;
        }
        return false;
    }

    /**
     * 取消文件选择回调
     * 当Activity被销毁时调用，防止内存泄漏
     */
    public void cancelFileChooserCallback() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
    }
}
