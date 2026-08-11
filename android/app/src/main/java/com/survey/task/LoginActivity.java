package com.survey.task;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 登录页面Activity
 * 功能：输入服务器地址、用户名、密码，验证后跳转WebView主页
 */
public class LoginActivity extends AppCompatActivity {

    // SharedPreferences文件名和键名
    private static final String PREFS_NAME = "SurveyTaskPrefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String KEY_REMEMBER_SERVER = "remember_server";
    private static final String KEY_JWT_TOKEN = "jwt_token";
    private static final String KEY_USERNAME = "username";

    // UI控件
    private EditText etServerUrl;
    private EditText etUsername;
    private EditText etPassword;
    private CheckBox cbRememberServer;
    private Button btnLogin;
    private ProgressBar progressBar;

    // SharedPreferences实例
    private SharedPreferences sharedPreferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        // 初始化SharedPreferences
        sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        // 初始化视图
        initViews();

        // 加载已保存的服务器地址
        loadSavedServerUrl();

        // 设置登录按钮点击事件
        btnLogin.setOnClickListener(v -> attemptLogin());
    }

    /**
     * 初始化视图控件
     */
    private void initViews() {
        etServerUrl = findViewById(R.id.et_server_url);
        etUsername = findViewById(R.id.et_username);
        etPassword = findViewById(R.id.et_password);
        cbRememberServer = findViewById(R.id.cb_remember_server);
        btnLogin = findViewById(R.id.btn_login);
        progressBar = findViewById(R.id.progress_bar);

        // 恢复记住的服务器地址状态
        cbRememberServer.setChecked(sharedPreferences.getBoolean(KEY_REMEMBER_SERVER, true));
    }

    /**
     * 加载已保存的服务器地址
     */
    private void loadSavedServerUrl() {
        String savedUrl = sharedPreferences.getString(KEY_SERVER_URL, "");
        String savedUsername = sharedPreferences.getString(KEY_USERNAME, "");
        if (!savedUrl.isEmpty()) {
            etServerUrl.setText(savedUrl);
        }
        if (!savedUsername.isEmpty()) {
            etUsername.setText(savedUsername);
        }
    }

    /**
     * 尝试登录
     */
    private void attemptLogin() {
        // 隐藏软键盘
        hideKeyboard();

        // 获取输入值
        String serverUrl = etServerUrl.getText().toString().trim();
        String username = etUsername.getText().toString().trim();
        String password = etPassword.getText().toString().trim();

        // 输入验证
        if (serverUrl.isEmpty()) {
            etServerUrl.setError("请输入服务器地址");
            etServerUrl.requestFocus();
            return;
        }

        // 确保服务器地址以http://或https://开头
        if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
            serverUrl = "http://" + serverUrl;
            etServerUrl.setText(serverUrl);
        }

        // 去除末尾的斜杠
        if (serverUrl.endsWith("/")) {
            serverUrl = serverUrl.substring(0, serverUrl.length() - 1);
        }

        if (username.isEmpty()) {
            etUsername.setError("请输入用户名");
            etUsername.requestFocus();
            return;
        }

        if (password.isEmpty()) {
            etPassword.setError("请输入密码");
            etPassword.requestFocus();
            return;
        }

        // 保存服务器地址（如果勾选了记住）
        saveServerUrl(serverUrl, username);

        // 显示加载状态
        showLoading(true);

        // 在后台线程执行登录请求
        new Thread(() -> {
            try {
                String token = loginRequest(serverUrl, username, password);
                if (token != null) {
                    // 登录成功，保存token
                    sharedPreferences.edit()
                            .putString(KEY_JWT_TOKEN, token)
                            .apply();

                    // 在主线程跳转到主页
                    runOnUiThread(() -> {
                        showLoading(false);
                        navigateToMain(serverUrl, token);
                    });
                } else {
                    // 登录失败
                    runOnUiThread(() -> {
                        showLoading(false);
                        Toast.makeText(LoginActivity.this,
                                "登录失败：用户名或密码错误", Toast.LENGTH_LONG).show();
                    });
                }
            } catch (Exception e) {
                // 网络错误或其他异常
                runOnUiThread(() -> {
                    showLoading(false);
                    Toast.makeText(LoginActivity.this,
                            "连接失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
                });
            }
        }).start();
    }

    /**
     * 发送登录HTTP请求
     * @param serverUrl 服务器地址
     * @param username 用户名
     * @param password 密码
     * @return JWT token，失败返回null
     */
    private String loginRequest(String serverUrl, String username, String password) throws Exception {
        URL url = new URL(serverUrl + "/api/auth/login");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(10000);  // 连接超时10秒
        conn.setReadTimeout(15000);      // 读取超时15秒
        conn.setDoOutput(true);

        // 构建请求体
        JSONObject requestBody = new JSONObject();
        requestBody.put("username", username);
        requestBody.put("password", password);

        // 发送请求
        try (OutputStream os = conn.getOutputStream()) {
            os.write(requestBody.toString().getBytes("UTF-8"));
            os.flush();
        }

        // 读取响应
        int responseCode = conn.getResponseCode();
        if (responseCode == HttpURLConnection.HTTP_OK) {
            java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(conn.getInputStream(), "UTF-8"));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();

            // 解析响应获取token
            JSONObject jsonResponse = new JSONObject(response.toString());
            if (jsonResponse.has("token")) {
                return jsonResponse.getString("token");
            } else if (jsonResponse.has("data")) {
                JSONObject data = jsonResponse.getJSONObject("data");
                if (data.has("token")) {
                    return data.getString("token");
                }
            }
        }

        return null;
    }

    /**
     * 保存服务器地址到SharedPreferences
     */
    private void saveServerUrl(String serverUrl, String username) {
        SharedPreferences.Editor editor = sharedPreferences.edit();
        if (cbRememberServer.isChecked()) {
            editor.putString(KEY_SERVER_URL, serverUrl);
            editor.putString(KEY_USERNAME, username);
            editor.putBoolean(KEY_REMEMBER_SERVER, true);
        } else {
            editor.remove(KEY_SERVER_URL);
            editor.remove(KEY_USERNAME);
            editor.putBoolean(KEY_REMEMBER_SERVER, false);
        }
        editor.apply();
    }

    /**
     * 跳转到主页面
     */
    private void navigateToMain(String serverUrl, String token) {
        Intent intent = new Intent(LoginActivity.this, MainActivity.class);
        intent.putExtra("server_url", serverUrl);
        intent.putExtra("jwt_token", token);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    /**
     * 显示/隐藏加载状态
     */
    private void showLoading(boolean loading) {
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        btnLogin.setEnabled(!loading);
        btnLogin.setText(loading ? "登录中..." : "登 录");
    }

    /**
     * 隐藏软键盘
     */
    private void hideKeyboard() {
        View view = getCurrentFocus();
        if (view != null) {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            imm.hideSoftInputFromWindow(view.getWindowToken(), 0);
        }
    }
}
