package app.clinicnova.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.content.ContentValues;
import android.content.SharedPreferences;
import android.provider.MediaStore;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.util.Base64;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String HOME_URL = "file:///android_asset/index.html";
    private static final int FILE_CHOOSER_REQUEST = 4102;
    private static final String MESH_KEY_ALIAS = "clinicnova.mesh.local.v1";
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraPhotoUri;
    private boolean recoveringFromRemoteError = false;
    private String trustedOrigin = null;
    private final SyncBridge syncBridge = new SyncBridge();
    private MeshTransport meshTransport;
    private SharedPreferences meshPreferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();
        meshPreferences = getSharedPreferences("clinicnova_mesh", MODE_PRIVATE);
        meshTransport = new MeshTransport(this, new MeshTransport.Listener() {
            public String getEnvelope() { return meshRead("envelope"); }
            public void onEnvelope(String envelope, String peerName) { runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript("window.ClinicNovaMeshEnvelope && window.ClinicNovaMeshEnvelope(" + JSONObject.quote(envelope) + "," + JSONObject.quote(peerName) + ")", null); }); }
            public void onStatus(String status, String peerName) { runOnUiThread(() -> { if (webView != null) webView.evaluateJavascript("window.ClinicNovaMeshStatus && window.ClinicNovaMeshStatus(" + JSONObject.quote(status) + "," + JSONObject.quote(peerName) + ")", null); }); }
        });
        configureWebView();
        setContentView(webView);

        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
        String meshConfig = meshRead("config");
        if (!meshConfig.isEmpty()) try { meshTransport.configure(meshConfig); } catch (Exception ignored) {}
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(248, 250, 252));
        window.setNavigationBarColor(Color.WHITE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            window.getDecorView().setSystemUiVisibility(
                window.getDecorView().getSystemUiVisibility() | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            );
        }
    }

    private void configureWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(248, 250, 252));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        WebView.setWebContentsDebuggingEnabled(false);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " ClinicNovaAndroid/" + appVersion());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);
        webView.addJavascriptInterface(syncBridge, "ClinicNovaNative");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                boolean cameraCapture = params != null && params.isCaptureEnabled();
                Intent intent;
                if (cameraCapture) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Images.Media.DISPLAY_NAME, "clinicnova-" + System.currentTimeMillis() + ".jpg");
                    values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    cameraPhotoUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                    intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                    intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } else {
                    cameraPhotoUri = null;
                    intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "image/*", "application/pdf" });
                }
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileCallback = null;
                    if (cameraPhotoUri != null) getContentResolver().delete(cameraPhotoUri, null, null);
                    cameraPhotoUri = null;
                    Toast.makeText(MainActivity.this, cameraCapture ? "Kamera açılamadı." : "Dosya seçici açılamadı.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("clinicnova".equalsIgnoreCase(scheme) && "sync".equalsIgnoreCase(uri.getHost())) {
                    view.loadUrl(HOME_URL + "?sync=1");
                    return true;
                }
                if ("https".equalsIgnoreCase(scheme)) {
                    if (view.getUrl() != null && view.getUrl().startsWith("file:///android_asset/")) {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, uri));
                        } catch (ActivityNotFoundException ignored) {
                            Toast.makeText(MainActivity.this, "Satın alma sayfası açılamadı.", Toast.LENGTH_SHORT).show();
                        }
                        return true;
                    }
                    if (trustedOrigin != null && trustedOrigin.equals(originOf(uri))) return false;
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (ActivityNotFoundException ignored) {
                        Toast.makeText(MainActivity.this, "Bağlantı açılamadı.", Toast.LENGTH_SHORT).show();
                    }
                    return true;
                }
                if ("file".equalsIgnoreCase(scheme) && uri.toString().startsWith("file:///android_asset/")) return false;
                if ("http".equalsIgnoreCase(scheme)) {
                    Toast.makeText(MainActivity.this, "Güvenli bağlantı için HTTPS gerekli.", Toast.LENGTH_SHORT).show();
                    return true;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    Toast.makeText(MainActivity.this, "Bu bağlantı açılamadı.", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (url != null && url.startsWith("file:///android_asset/")) view.addJavascriptInterface(syncBridge, "ClinicNovaNative");
                else view.removeJavascriptInterface("ClinicNovaNative");
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                recoveringFromRemoteError = false;
                super.onPageFinished(view, url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !request.getUrl().toString().startsWith("file:") && !recoveringFromRemoteError) {
                    recoveringFromRemoteError = true;
                    Toast.makeText(MainActivity.this, "Canlı sisteme ulaşılamadı; çevrimdışı ekran açıldı.", Toast.LENGTH_LONG).show();
                    view.loadUrl(HOME_URL + "?offline=1");
                }
            }

        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (ActivityNotFoundException ignored) {
                Toast.makeText(this, "İndirme bağlantısı açılamadı.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private final class SyncBridge {
        @JavascriptInterface public String storageGet(String key) { return validStorageKey(key) ? meshRead("store-" + key) : null; }
        @JavascriptInterface public boolean storageSet(String key, String value) { return validStorageKey(key) && value != null && value.getBytes(StandardCharsets.UTF_8).length <= 64 * 1024 * 1024 && meshWrite("store-" + key, value); }
        @JavascriptInterface public String meshGetConfig() { return meshRead("config"); }
        @JavascriptInterface public String meshGetEnvelope() { return meshRead("envelope"); }
        @JavascriptInterface public boolean meshConfigure(String json) { try { if (json == null || json.getBytes(StandardCharsets.UTF_8).length > 8192) return false; meshTransport.configure(json); return meshWrite("config", json); } catch (Exception ignored) { return false; } }
        @JavascriptInterface public boolean meshPublish(String envelope) { if (envelope == null || envelope.getBytes(StandardCharsets.UTF_8).length > 64 * 1024 * 1024) return false; return meshWrite("envelope", envelope); }
        @JavascriptInterface public void meshSyncNow() { meshTransport.announce(); }
        @JavascriptInterface public boolean meshDisable() { meshTransport.stop(); return meshPreferences.edit().clear().commit(); }
        @JavascriptInterface
        public void connect(String serverUrl) {
            runOnUiThread(() -> {
                try {
                    URL base = validatedServerUrl(serverUrl);
                    trustedOrigin = originOf(Uri.parse(base.toString()));
                    webView.loadUrl(base.toString() + "/login?next=%2Fmobile-connect&mobile=android");
                } catch (Exception ignored) {
                    Toast.makeText(MainActivity.this, "Geçerli bir HTTPS ClinicNova adresi girin.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void openPortal(String serverUrl, String path) {
            runOnUiThread(() -> {
                try {
                    URL base = validatedServerUrl(serverUrl);
                    String safePath = path != null && (path.equals("/dashboard") || path.startsWith("/dashboard/")) ? path : "/dashboard";
                    trustedOrigin = originOf(Uri.parse(base.toString()));
                    webView.loadUrl(base.toString() + safePath);
                } catch (Exception ignored) {
                    Toast.makeText(MainActivity.this, "Canlı panel açılamadı.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public String hashSecret(String secret, String saltBase64, int iterations) {
            if (secret == null || saltBase64 == null || iterations < 100_000 || iterations > 1_000_000) return "";
            PBEKeySpec spec = null;
            try {
                byte[] salt = Base64.decode(saltBase64, Base64.DEFAULT);
                spec = new PBEKeySpec(secret.toCharArray(), salt, iterations, 256);
                byte[] hash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
                return Base64.encodeToString(hash, Base64.NO_WRAP);
            } catch (Exception ignored) {
                return "";
            } finally {
                if (spec != null) spec.clearPassword();
            }
        }

        @JavascriptInterface
        public void sync(String serverUrl, String batchJson) {
            new Thread(() -> performSync(serverUrl, batchJson)).start();
        }

        @JavascriptInterface
        public void productSearch(String serverUrl, String productUrl, String itemId) {
            new Thread(() -> performProductSearch(serverUrl, productUrl, itemId)).start();
        }
    }

    private boolean validStorageKey(String key) { return key != null && key.matches("^clinicnova\\.[A-Za-z0-9._-]{1,80}$"); }

    private SecretKey meshEncryptionKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        java.security.Key existing = store.getKey(MESH_KEY_ALIAS, null);
        if (existing instanceof SecretKey) return (SecretKey) existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(MESH_KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return generator.generateKey();
    }

    private String meshRead(String name) {
        try {
            String stored = meshPreferences.getString(name, ""); if (stored.isEmpty()) return "";
            JSONObject value = new JSONObject(stored); byte[] iv = Base64.decode(value.getString("iv"), Base64.DEFAULT); byte[] data = Base64.decode(value.getString("data"), Base64.DEFAULT);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, meshEncryptionKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(data), StandardCharsets.UTF_8);
        } catch (Exception ignored) { return ""; }
    }

    private boolean meshWrite(String name, String plaintext) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, meshEncryptionKey());
            JSONObject stored = new JSONObject(); stored.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)); stored.put("data", Base64.encodeToString(cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP));
            return meshPreferences.edit().putString(name, stored.toString()).commit();
        } catch (Exception ignored) { return false; }
    }

    private URL validatedServerUrl(String serverUrl) throws Exception {
        URL base = new URL(serverUrl == null ? "" : serverUrl.trim().replaceAll("/+$", ""));
        int port = base.getPort();
        if (!"https".equalsIgnoreCase(base.getProtocol()) || base.getHost() == null || base.getHost().isEmpty() || base.getUserInfo() != null || (port != -1 && port != 443) || (!base.getPath().isEmpty() && !"/".equals(base.getPath()))) {
            throw new IllegalArgumentException("HTTPS sunucu adresi gerekli.");
        }
        return new URL("https", base.getHost(), -1, "");
    }

    private String originOf(Uri uri) {
        if (uri == null || uri.getHost() == null || !"https".equalsIgnoreCase(uri.getScheme())) return "";
        int port = uri.getPort();
        return "https://" + uri.getHost().toLowerCase() + (port == -1 || port == 443 ? "" : ":" + port);
    }

    private void performProductSearch(String serverUrl, String productUrl, String itemId) {
        HttpURLConnection connection = null;
        int status = 0;
        String responseBody = "";
        try {
            URL base = validatedServerUrl(serverUrl);
            String normalizedProductUrl = productUrl == null ? "" : productUrl.trim();
            URL pageUrl = new URL(normalizedProductUrl);
            if (!"https".equalsIgnoreCase(pageUrl.getProtocol()) || pageUrl.getHost() == null || pageUrl.getHost().isEmpty()) throw new IllegalArgumentException("HTTPS satın alma sayfası gerekli.");
            URL endpoint = new URL(base.getProtocol(), base.getHost(), -1, "/api/mobile/product-search");
            connection = (HttpURLConnection) endpoint.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(30_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "ClinicNovaAndroid/" + appVersion());
            String cookies = CookieManager.getInstance().getCookie(serverUrl);
            if (cookies != null && !cookies.isEmpty()) connection.setRequestProperty("Cookie", cookies);
            byte[] body = new JSONObject().put("productUrl", normalizedProductUrl).toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) { output.write(body); }
            status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream != null) {
                StringBuilder response = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) response.append(line);
                }
                responseBody = response.toString();
            }
        } catch (Exception error) {
            status = 0;
            responseBody = "{\"error\":" + JSONObject.quote(error.getMessage() == null ? "İnternet fiyatları alınamadı." : error.getMessage()) + "}";
        } finally {
            if (connection != null) connection.disconnect();
        }
        final int callbackStatus = status;
        final String callbackBody = responseBody;
        final String callbackItemId = itemId == null ? "" : itemId;
        runOnUiThread(() -> {
            if (webView == null) return;
            webView.evaluateJavascript("window.ClinicNovaProductSearchResult && window.ClinicNovaProductSearchResult(" + callbackStatus + "," + JSONObject.quote(callbackBody) + "," + JSONObject.quote(callbackItemId) + ")", null);
        });
    }

    private void performSync(String serverUrl, String batchJson) {
        HttpURLConnection connection = null;
        int status = 0;
        String responseBody = "";
        try {
            URL base = validatedServerUrl(serverUrl);
            if (batchJson == null || batchJson.getBytes(StandardCharsets.UTF_8).length > 4 * 1024 * 1024) {
                throw new IllegalArgumentException("Senkronizasyon paketi çok büyük.");
            }
            URL endpoint = new URL(base.getProtocol(), base.getHost(), -1, "/api/mobile/sync");
            connection = (HttpURLConnection) endpoint.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(30_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "ClinicNovaAndroid/" + appVersion());
            String cookies = CookieManager.getInstance().getCookie(serverUrl);
            if (cookies != null && !cookies.isEmpty()) connection.setRequestProperty("Cookie", cookies);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(batchJson.getBytes(StandardCharsets.UTF_8));
            }
            status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream != null) {
                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) body.append(line);
                }
                responseBody = body.toString();
            }
        } catch (Exception error) {
            status = 0;
            responseBody = "{\"error\":" + JSONObject.quote(error.getMessage() == null ? "Sunucuya ulaşılamadı." : error.getMessage()) + "}";
        } finally {
            if (connection != null) connection.disconnect();
        }
        final int callbackStatus = status;
        final String callbackBody = responseBody;
        runOnUiThread(() -> {
            if (webView == null) return;
            webView.evaluateJavascript("window.ClinicNovaSyncResult && window.ClinicNovaSyncResult(" + callbackStatus + "," + JSONObject.quote(callbackBody) + ")", null);
        });
    }

    private String appVersion() {
        try {
            String version = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            return version == null ? "unknown" : version;
        } catch (Exception ignored) {
            return "unknown";
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;
        Uri selectedUri = data != null ? data.getData() : null;
        Uri[] result = resultCode == RESULT_OK && cameraPhotoUri != null
            ? new Uri[] { cameraPhotoUri }
            : resultCode == RESULT_OK && selectedUri != null ? new Uri[] { selectedUri } : null;
        if (resultCode != RESULT_OK && cameraPhotoUri != null) getContentResolver().delete(cameraPhotoUri, null, null);
        fileCallback.onReceiveValue(result);
        fileCallback = null;
        cameraPhotoUri = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
            "Boolean(window.ClinicNovaBack && window.ClinicNovaBack())",
            handled -> {
                if ("true".equals(handled)) return;
                if (webView.canGoBack()) webView.goBack();
                else MainActivity.super.onBackPressed();
            }
        );
    }

    @Override
    protected void onDestroy() {
        if (meshTransport != null) meshTransport.stop();
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }
}
