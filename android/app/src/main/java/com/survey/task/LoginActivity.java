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

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 登录页面Activity
 * 功能：输入服务器地址、用户名、密码，验证后跳转WebView主页
 * 支持：记住用户名密码、自动登录
 */
public class LoginActivity extends AppCompatActivity {

    // SharedPreferences文件名和键名
    private static final String PREFS_NAME = "SurveyTaskPrefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String KEY_USERNAME = "username";
    private static final String KEY_PASSWORD = "password";
    private static final String KEY_REMEMBER = "remember";
    private static final String KEY_JWT_TOKEN = "jwt_token";

    // UI控件
    private EditText etServerUrl;
    private EditText etUsername;
    private EditText etPassword;
    private CheckBox cbRemember;
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

        // 加载已保存的账号信息
        loadSavedCredentials();

        // 设置登录按钮点击事件
        btnLogin.setOnClickListener(v -> attemptLogin());

        // 检查是否有已保存的有效token，自动登录
        checkAutoLogin();
    }

    /**
     * 初始化视图控件
     */
    private void initViews() {
        etServerUrl = findViewById(R.id.et_server_url);
        etUsername = findViewById(R.id.et_username);
        etPassword = findViewById(R.id.et_password);
        cbRemember = findViewById(R.id.cb_remember_server);
        btnLogin = findViewById(R.id.btn_login);
        progressBar = findViewById(R.id.progress_bar);

        // 恢复记住密码的状态
        cbRemember.setChecked(sharedPreferences.getBoolean(KEY_REMEMBER, true));
    }

    /**
     * 加载已保存的账号信息
     */
    private void loadSavedCredentials() {
        String savedUrl = sharedPreferences.getString(KEY_SERVER_URL, "");
        String savedUsername = sharedPreferences.getString(KEY_USERNAME, "");
        String savedPassword = sharedPreferences.getString(KEY_PASSWORD, "");

        if (!savedUrl.isEmpty()) {
            etServerUrl.setText(savedUrl);
        }
        if (!savedUsername.isEmpty()) {
            etUsername.setText(savedUsername);
        }
        if (!savedPassword.isEmpty()) {
            etPassword.setText(savedPassword);
        }
    }

    /**
     * 检查自动登录 - 如果有已保存的有效token，直接跳转
     */
    private void checkAutoLogin() {
        String savedToken = sharedPreferences.getString(KEY_JWT_TOKEN, "");
        String savedUrl = sharedPreferences.getString(KEY_SERVER_URL, "");

        if (savedToken.isEmpty() || savedUrl.isEmpty()) {
            return;
        }

        // 显示加载状态
        showLoading(true);

        // 在后台线程验证token
        new Thread(() -> {
            try {
                boolean isValid = validateToken(savedUrl, savedToken);
                if (isValid) {
                    // Token有效，直接跳转主页
                    runOnUiThread(() -> {
                        showLoading(false);
                        navigateToMain(savedUrl, savedToken);
                    });
                } else {
                    // Token无效，清除并显示登录页
                    sharedPreferences.edit().remove(KEY_JWT_TOKEN).apply();
                    runOnUiThread(() -> showLoading(false));
                }
            } catch (Exception e) {
                // 验证失败（网络问题等），显示登录页
                runOnUiThread(() -> showLoading(false));
            }
        }).start();
    }

    /**
     * 验证token是否仍然有效
     */
    private boolean validateToken(String serverUrl, String token) throws Exception {
        URL url = new URL(serverUrl + "/api/auth/me");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Authorization", "Bearer " + token);
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);

        int responseCode = conn.getResponseCode();
        if (responseCode == HttpURLConnection.HTTP_OK) {
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), "UTF-8"));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();

            JSONObject jsonResponse = new JSONObject(response.toString());
            return jsonResponse.optInt("code") == 0;
        }
        return false;
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

        // 保存账号信息（如果勾选了记住）
        saveCredentials(serverUrl, username, password);

        // 创建final副本供lambda使用
        final String finalServerUrl = serverUrl;

        // 显示加载状态
        showLoading(true);

        // 在后台线程执行登录请求
        new Thread(() -> {
            try {
                String token = loginRequest(finalServerUrl, username, password);
                if (token != null) {
                    // 登录成功，保存token
                    sharedPreferences.edit()
                            .putString(KEY_JWT_TOKEN, token)
                            .apply();

                    // 在主线程跳转到主页
                    runOnUiThread(() -> {
                        showLoading(false);
                        navigateToMain(finalServerUrl, token);
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
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), "UTF-8"));
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
     * 保存账号信息到SharedPreferences
     */
    private void saveCredentials(String serverUrl, String username, String password) {
        SharedPreferences.Editor editor = sharedPreferences.edit();
        if (cbRemember.isChecked()) {
            editor.putString(KEY_SERVER_URL, serverUrl);
            editor.putString(KEY_USERNAME, username);
            editor.putString(KEY_PASSWORD, password);
            editor.putBoolean(KEY_REMEMBER, true);
        } else {
            editor.remove(KEY_SERVER_URL);
            editor.remove(KEY_USERNAME);
            editor.remove(KEY_PASSWORD);
            editor.putBoolean(KEY_REMEMBER, false);
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