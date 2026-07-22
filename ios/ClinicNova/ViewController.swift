import UIKit
import WebKit
import UserNotifications
import CryptoKit

final class ViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, UNUserNotificationCenterDelegate {
    private let store = SecureMeshStore()
    private let maximumSyncResponseBytes = 64 * 1024 * 1024
    private let maximumProductResponseBytes = 2 * 1024 * 1024
    private let maximumRequestBytes = 4 * 1024 * 1024
    private let maximumMeshEnvelopeBytes = 47 * 1024 * 1024
    private let messageNames = [
        "meshSyncNow",
        "requestNotificationPermission", "showLocalNotification", "connect", "openPortal", "sync", "productSearch", "hashSecret"
    ]
    private var localRecords: [String: String] = [:]
    private var trustedOrigin: String?
    private var webView: WKWebView!
    private lazy var mesh = MeshTransport(
        getEnvelope: { [weak self] in self?.store.read("envelope") ?? "" },
        onEnvelope: { [weak self] envelope, peer in self?.call("ClinicNovaMeshEnvelope", envelope, peer) },
        onStatus: { [weak self] status, peer in self?.call("ClinicNovaMeshStatus", status, peer) }
    )

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 248 / 255, green: 250 / 255, blue: 252 / 255, alpha: 1)
        let content = WKUserContentController()
        if let data = store.read("records").data(using: .utf8),
           let values = try? JSONDecoder().decode([String: String].self, from: data) {
            localRecords = values
        }
        for name in messageNames { content.add(self, name: name) }
        UNUserNotificationCenter.current().delegate = self
        content.addUserScript(WKUserScript(source: nativeBridgeScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = content
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.applicationNameForUserAgent = "ClinicNovaIOS/\(appVersion())"
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.allowsLinkPreview = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        let config = store.read("config")
        if !config.isEmpty { try? mesh.configure(config) }
        loadHome()
    }

    deinit {
        mesh.stop()
        for name in messageNames { webView?.configuration.userContentController.removeScriptMessageHandler(forName: name) }
    }

    @discardableResult
    func handleDeepLink(_ url: URL) -> Bool {
        guard isExactSyncURL(url) else { return false }
        trustedOrigin = nil
        if isViewLoaded { loadHome(query: "sync=1") }
        return true
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, isPackagedMainFrame(message.frameInfo) else { return }
        switch message.name {
        case "meshSyncNow":
            mesh.syncNow()
        case "requestNotificationPermission":
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        case "showLocalNotification":
            guard let value = message.body as? [String: Any] else { return }
            let content = UNMutableNotificationContent()
            content.title = String((value["title"] as? String ?? "ClinicNova").prefix(80))
            content.body = String((value["body"] as? String ?? "").prefix(240))
            content.sound = .default
            let identifier = String((value["tag"] as? String ?? UUID().uuidString).prefix(120))
            UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: identifier, content: content, trigger: nil))
        case "connect":
            guard let value = message.body as? String else { return }
            openServerLogin(value)
        case "openPortal":
            guard let value = message.body as? [String: Any],
                  let serverURL = value["serverUrl"] as? String else { return }
            openPortal(serverURL: serverURL, path: value["path"] as? String ?? "/dashboard")
        case "sync":
            guard let value = message.body as? [String: Any],
                  let serverURL = value["serverUrl"] as? String,
                  let batch = value["batchJson"] as? String,
                  batch.utf8.count <= maximumRequestBytes else {
                completeSync(status: 0, body: errorJSON("Senkronizasyon paketi çok büyük."))
                return
            }
            performSync(serverURL: serverURL, batch: batch)
        case "productSearch":
            guard let value = message.body as? [String: Any],
                  let serverURL = value["serverUrl"] as? String,
                  let productURL = value["productUrl"] as? String else { return }
            performProductSearch(serverURL: serverURL, productURL: productURL, itemID: String(describing: value["itemId"] ?? ""))
        case "hashSecret":
            guard let value = message.body as? [String: Any],
                  let requestID = value["requestId"] as? String,
                  requestID.range(of: "^[A-Za-z0-9-]{1,100}$", options: .regularExpression) != nil,
                  let secret = value["secret"] as? String, secret.utf8.count <= 4096,
                  let saltText = value["salt"] as? String,
                  let salt = Data(base64Encoded: saltText), (8...64).contains(salt.count),
                  let iterations = (value["iterations"] as? NSNumber)?.intValue,
                  (100_000...1_000_000).contains(iterations) else { return }
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                let result = self?.deriveSecret(secret, salt: salt, iterations: iterations) ?? ""
                self?.evaluate("window.ClinicNovaNativeResolveHash && window.ClinicNovaNativeResolveHash(\(self?.jsonString(requestID) ?? "null"),\(self?.jsonString(result) ?? "null"))")
            }
        default:
            break
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
        if isPackagedURL(url) || url.scheme == "about" { return decisionHandler(.allow) }
        if isExactSyncURL(url) {
            trustedOrigin = nil
            loadHome(query: "sync=1")
            return decisionHandler(.cancel)
        }
        if url.scheme?.lowercased() == "https" {
            if trustedOrigin == origin(of: url) { return decisionHandler(.allow) }
            if navigationAction.targetFrame?.isMainFrame == false { return decisionHandler(.cancel) }
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        if ["tel", "mailto", "sms"].contains(url.scheme?.lowercased() ?? "") {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard navigationAction.targetFrame == nil, let url = navigationAction.request.url else { return nil }
        if isPackagedURL(url) || (url.scheme?.lowercased() == "https" && trustedOrigin == origin(of: url)) {
            webView.load(navigationAction.request)
        } else if ["https", "tel", "mailto", "sms"].contains(url.scheme?.lowercased() ?? "") {
            UIApplication.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "ClinicNova", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Tamam", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "ClinicNova", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Vazgeç", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "Onayla", style: .destructive) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let nativePrompts = ["__clinicnova_storage_set__", "__clinicnova_mesh_configure__", "__clinicnova_mesh_publish__", "__clinicnova_mesh_disable__"]
        if nativePrompts.contains(prompt) {
            guard frame.isMainFrame, isPackagedMainFrame(frame) else { completionHandler(nil); return }
            switch prompt {
            case "__clinicnova_storage_set__":
                guard let text = defaultText, text.utf8.count <= 64 * 1024 * 1024,
                      let data = text.data(using: .utf8),
                      let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let key = value["key"] as? String,
                      let stored = value["value"] as? String else { completionHandler(nil); return }
                completionHandler(writeLocalRecord(key: key, value: stored) ? "ok" : nil)
            case "__clinicnova_mesh_configure__":
                guard let value = defaultText, value.utf8.count <= 8192 else { completionHandler(nil); return }
                completionHandler(configureMesh(value) ? "ok" : nil)
            case "__clinicnova_mesh_publish__":
                guard let value = defaultText, value.utf8.count <= maximumMeshEnvelopeBytes else { completionHandler(nil); return }
                completionHandler(store.write("envelope", value: value) ? "ok" : nil)
            case "__clinicnova_mesh_disable__":
                mesh.stop()
                completionHandler(store.clearMesh() ? "ok" : nil)
            default:
                completionHandler(nil)
            }
            return
        }
        guard frame.isMainFrame else { completionHandler(nil); return }
        let alert = UIAlertController(title: "ClinicNova", message: prompt, preferredStyle: .alert)
        alert.addTextField { field in field.text = defaultText }
        alert.addAction(UIAlertAction(title: "Vazgeç", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "Tamam", style: .default) { [weak alert] _ in completionHandler(alert?.textFields?.first?.text) })
        present(alert, animated: true)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }

    private func nativeBridgeScript() -> String {
        let config = jsonString(store.read("config"))
        let envelope = jsonString(store.read("envelope"))
        let records = (try? JSONSerialization.data(withJSONObject: localRecords, options: [.sortedKeys]))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        return """
        if (window.location.protocol === "file:" && window.location.pathname.endsWith("/index.html")) {
          window.__clinicNovaIOSConfig = \(config);
          window.__clinicNovaIOSEnvelope = \(envelope);
          window.__clinicNovaIOSRecords = \(records);
          window.__clinicNovaIOSHashRequests = Object.create(null);
          window.ClinicNovaNativeResolveHash = function(requestId,result){
            var resolve = window.__clinicNovaIOSHashRequests[requestId];
            if (!resolve) return;
            delete window.__clinicNovaIOSHashRequests[requestId];
            resolve(String(result || ""));
          };
          window.ClinicNovaNative = Object.freeze({
            platform: "ios",
            storageGet: function(key){ return Object.prototype.hasOwnProperty.call(window.__clinicNovaIOSRecords,key) ? window.__clinicNovaIOSRecords[key] : null; },
            storageSet: function(key,value){
              var result = null;
              try { result = window.prompt("__clinicnova_storage_set__", JSON.stringify({key:key,value:value})); } catch (_) { return false; }
              if (result !== "ok") return false;
              window.__clinicNovaIOSRecords[key] = value;
              return true;
            },
            meshGetConfig: function(){ return window.__clinicNovaIOSConfig || ""; },
            meshGetEnvelope: function(){ return window.__clinicNovaIOSEnvelope || ""; },
            meshConfigure: function(value){
              var normalized = String(value || "");
              var result = null;
              try { result = window.prompt("__clinicnova_mesh_configure__", normalized); } catch (_) { return false; }
              if (result !== "ok") return false;
              window.__clinicNovaIOSConfig = normalized;
              return true;
            },
            meshPublish: function(value){
              var normalized = String(value || "");
              var result = null;
              try { result = window.prompt("__clinicnova_mesh_publish__", normalized); } catch (_) { return false; }
              if (result !== "ok") return false;
              window.__clinicNovaIOSEnvelope = normalized;
              return true;
            },
            meshSyncNow: function(){ window.webkit.messageHandlers.meshSyncNow.postMessage(""); },
            meshDisable: function(){
              var result = null;
              try { result = window.prompt("__clinicnova_mesh_disable__", ""); } catch (_) { return false; }
              if (result !== "ok") return false;
              window.__clinicNovaIOSConfig = "";
              window.__clinicNovaIOSEnvelope = "";
              return true;
            },
            requestNotificationPermission: function(){ window.webkit.messageHandlers.requestNotificationPermission.postMessage(""); },
            showLocalNotification: function(title,body,tag){ window.webkit.messageHandlers.showLocalNotification.postMessage({title:title,body:body,tag:tag}); },
            connect: function(serverUrl){ window.webkit.messageHandlers.connect.postMessage(String(serverUrl || "")); },
            openPortal: function(serverUrl,path){ window.webkit.messageHandlers.openPortal.postMessage({serverUrl:String(serverUrl || ""),path:String(path || "/dashboard")}); },
            sync: function(serverUrl,batchJson){ window.webkit.messageHandlers.sync.postMessage({serverUrl:String(serverUrl || ""),batchJson:String(batchJson || "")}); },
            productSearch: function(serverUrl,productUrl,itemId){ window.webkit.messageHandlers.productSearch.postMessage({serverUrl:String(serverUrl || ""),productUrl:String(productUrl || ""),itemId:String(itemId || "")}); },
            hashSecret: function(secret,salt,iterations){
              return new Promise(function(resolve){
                var requestId = "hash-" + Date.now() + "-" + Math.random().toString(16).slice(2);
                var timeout = setTimeout(function(){ delete window.__clinicNovaIOSHashRequests[requestId]; resolve(""); }, 120000);
                window.__clinicNovaIOSHashRequests[requestId] = function(result){ clearTimeout(timeout); resolve(result); };
                window.webkit.messageHandlers.hashSecret.postMessage({requestId:requestId,secret:String(secret || ""),salt:String(salt || ""),iterations:Number(iterations || 0)});
              });
            }
          });
        }
        """
    }

    private func loadHome(query: String? = nil) {
        guard let fileURL = Bundle.main.url(forResource: "index", withExtension: "html") else { return }
        var components = URLComponents(url: fileURL, resolvingAgainstBaseURL: false)
        components?.percentEncodedQuery = query
        guard let url = components?.url else { return }
        webView.loadFileURL(url, allowingReadAccessTo: fileURL.deletingLastPathComponent())
    }

    private func openServerLogin(_ value: String) {
        do {
            let base = try validatedServerURL(value)
            trustedOrigin = origin(of: base)
            var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
            components.path = "/login"
            components.queryItems = [URLQueryItem(name: "next", value: "/mobile-connect"), URLQueryItem(name: "mobile", value: "ios")]
            guard let url = components.url else { throw NativeError.invalidServerURL }
            webView.load(URLRequest(url: url))
        } catch {
            presentNativeError("Geçerli bir HTTPS ClinicNova adresi girin.")
        }
    }

    private func openPortal(serverURL value: String, path: String) {
        do {
            let base = try validatedServerURL(value)
            guard path == "/dashboard" || path.hasPrefix("/dashboard/"),
                  !path.contains("?"), !path.contains("#"), !path.contains("\\"),
                  !path.split(separator: "/").contains("..") else { throw NativeError.invalidPortalPath }
            var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
            components.path = path
            guard let url = components.url else { throw NativeError.invalidPortalPath }
            trustedOrigin = origin(of: base)
            webView.load(URLRequest(url: url))
        } catch {
            presentNativeError("Canlı panel açılamadı.")
        }
    }

    private func performSync(serverURL: String, batch: String) {
        guard let body = batch.data(using: .utf8) else {
            completeSync(status: 0, body: errorJSON("Senkronizasyon paketi geçersiz."))
            return
        }
        performJSONRequest(serverURL: serverURL, path: "/api/mobile/sync", body: body, maximumResponseBytes: maximumSyncResponseBytes) { [weak self] result in
            switch result {
            case let .success(response): self?.completeSync(status: response.status, body: response.body)
            case let .failure(error): self?.completeSync(status: 0, body: self?.errorJSON(error.localizedDescription) ?? "{}")
            }
        }
    }

    private func performProductSearch(serverURL: String, productURL: String, itemID: String) {
        do {
            guard let components = URLComponents(string: productURL.trimmingCharacters(in: .whitespacesAndNewlines)),
                  components.scheme?.lowercased() == "https", components.host?.isEmpty == false,
                  components.user == nil, components.password == nil else { throw NativeError.invalidProductURL }
            let body = try JSONSerialization.data(withJSONObject: ["productUrl": components.url!.absoluteString])
            performJSONRequest(serverURL: serverURL, path: "/api/mobile/product-search", body: body, maximumResponseBytes: maximumProductResponseBytes) { [weak self] result in
                switch result {
                case let .success(response): self?.completeProductSearch(status: response.status, body: response.body, itemID: itemID)
                case let .failure(error): self?.completeProductSearch(status: 0, body: self?.errorJSON(error.localizedDescription) ?? "{}", itemID: itemID)
                }
            }
        } catch {
            completeProductSearch(status: 0, body: errorJSON("HTTPS satın alma sayfası gerekli."), itemID: itemID)
        }
    }

    private func performJSONRequest(serverURL: String, path: String, body: Data, maximumResponseBytes: Int, completion: @escaping (Result<NativeHTTPResponse, Error>) -> Void) {
        do {
            let base = try validatedServerURL(serverURL)
            var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
            components.path = path
            guard let endpoint = components.url else { throw NativeError.invalidServerURL }
            webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { [weak self] cookies in
                guard let self = self else { return }
                var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 45)
                request.httpMethod = "POST"
                request.httpBody = body
                request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
                request.setValue("application/json", forHTTPHeaderField: "Accept")
                request.setValue("ClinicNovaIOS/\(self.appVersion())", forHTTPHeaderField: "User-Agent")
                let matching = cookies.filter { self.cookie($0, appliesTo: endpoint) }
                if let header = HTTPCookie.requestHeaderFields(with: matching)["Cookie"] { request.setValue(header, forHTTPHeaderField: "Cookie") }
                BoundedRequest(maximumBytes: maximumResponseBytes, allowedOrigin: self.origin(of: endpoint), completion: completion).start(request)
            }
        } catch {
            completion(.failure(error))
        }
    }

    private func completeSync(status: Int, body: String) {
        evaluate("window.ClinicNovaSyncResult && window.ClinicNovaSyncResult(\(status),\(jsonString(body)))")
    }

    private func completeProductSearch(status: Int, body: String, itemID: String) {
        evaluate("window.ClinicNovaProductSearchResult && window.ClinicNovaProductSearchResult(\(status),\(jsonString(body)),\(jsonString(itemID)))")
    }

    private func cookie(_ cookie: HTTPCookie, appliesTo url: URL) -> Bool {
        guard let host = url.host?.lowercased(), cookie.isSecure else { return false }
        let domain = cookie.domain.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        guard host == domain || host.hasSuffix(".\(domain)") else { return false }
        return url.path.hasPrefix(cookie.path)
    }

    private func validatedServerURL(_ value: String) throws -> URL {
        guard var components = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
              components.scheme?.lowercased() == "https", components.host?.isEmpty == false,
              components.user == nil, components.password == nil,
              components.port == nil || components.port == 443,
              components.path.isEmpty || components.path == "/",
              components.query == nil, components.fragment == nil else { throw NativeError.invalidServerURL }
        components.scheme = "https"
        components.host = components.host?.lowercased()
        components.port = nil
        components.path = ""
        guard let url = components.url else { throw NativeError.invalidServerURL }
        return url
    }

    private func origin(of url: URL) -> String {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "https", let host = components.host?.lowercased() else { return "" }
        return "https://\(host)\((components.port == nil || components.port == 443) ? "" : ":\(components.port!)")"
    }

    private func isPackagedURL(_ url: URL) -> Bool {
        guard url.isFileURL, let resourceURL = Bundle.main.resourceURL?.standardizedFileURL else { return false }
        let file = url.standardizedFileURL.path
        let root = resourceURL.path.hasSuffix("/") ? resourceURL.path : resourceURL.path + "/"
        return file.hasPrefix(root)
    }

    private func isExactSyncURL(_ url: URL) -> Bool {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "clinicnova", components.host?.lowercased() == "sync",
              components.user == nil, components.password == nil, components.port == nil,
              components.path.isEmpty || components.path == "/",
              components.query == nil, components.fragment == nil else { return false }
        return true
    }

    private func isPackagedMainFrame(_ frame: WKFrameInfo) -> Bool {
        isPackagedIndexURL(frame.request.url)
    }

    private func isPackagedIndexURL(_ url: URL?) -> Bool {
        guard let frameURL = url?.standardizedFileURL,
              let indexURL = Bundle.main.url(forResource: "index", withExtension: "html")?.standardizedFileURL else { return false }
        return frameURL.isFileURL && frameURL.path == indexURL.path
    }

    private func validStorageKey(_ key: String) -> Bool {
        key.range(of: "^clinicnova\\.[A-Za-z0-9._-]{1,80}$", options: .regularExpression) != nil
    }

    private func configureMesh(_ value: String) -> Bool {
        let previous = store.read("config")
        do {
            try mesh.configure(value)
            guard store.write("config", value: value) else {
                if previous.isEmpty { mesh.stop() } else { try? mesh.configure(previous) }
                return false
            }
            return true
        } catch {
            if previous.isEmpty { mesh.stop() } else { try? mesh.configure(previous) }
            return false
        }
    }

    private func call(_ function: String, _ first: String, _ second: String) {
        evaluate("window.\(function) && window.\(function)(\(jsonString(first)),\(jsonString(second)))")
    }

    private func evaluate(_ source: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.isPackagedIndexURL(self.webView?.url) else { return }
            self.webView.evaluateJavaScript(source)
        }
    }

    private func writeLocalRecord(key: String, value: String) -> Bool {
        guard validStorageKey(key), value.utf8.count <= 64 * 1024 * 1024 else { return false }
        var next = localRecords
        next[key] = value
        guard let data = try? JSONEncoder().encode(next),
              let text = String(data: data, encoding: .utf8),
              store.write("records", value: text) else { return false }
        localRecords = next
        return true
    }

    private func presentNativeError(_ message: String) {
        let alert = UIAlertController(title: "ClinicNova", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Tamam", style: .default))
        present(alert, animated: true)
    }

    private func appVersion() -> String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
    }

    private func deriveSecret(_ secret: String, salt: Data, iterations: Int) -> String {
        let key = SymmetricKey(data: Data(secret.utf8))
        var block = salt
        var blockIndex = UInt32(1).bigEndian
        withUnsafeBytes(of: &blockIndex) { block.append(contentsOf: $0) }
        var previous = Data(HMAC<SHA256>.authenticationCode(for: block, using: key))
        var derived = [UInt8](previous)
        if iterations > 1 {
            for _ in 1..<iterations {
                previous = Data(HMAC<SHA256>.authenticationCode(for: previous, using: key))
                let bytes = [UInt8](previous)
                for index in derived.indices { derived[index] ^= bytes[index] }
            }
        }
        return Data(derived).base64EncodedString()
    }

    private func errorJSON(_ message: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: ["error": message]),
              let text = String(data: data, encoding: .utf8) else { return "{\"error\":\"İşlem tamamlanamadı.\"}" }
        return text
    }

    private func jsonString(_ value: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [value])
        let array = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(array.dropFirst().dropLast())
    }

    private enum NativeError: LocalizedError {
        case invalidServerURL, invalidPortalPath, invalidProductURL
        var errorDescription: String? {
            switch self {
            case .invalidServerURL: return "Geçerli bir HTTPS ClinicNova adresi gerekli."
            case .invalidPortalPath: return "Canlı panel yolu geçersiz."
            case .invalidProductURL: return "HTTPS satın alma sayfası gerekli."
            }
        }
    }
}

private struct NativeHTTPResponse {
    let status: Int
    let body: String
}

private final class BoundedRequest: NSObject, URLSessionDataDelegate, URLSessionTaskDelegate {
    private let maximumBytes: Int
    private let allowedOrigin: String
    private let completion: (Result<NativeHTTPResponse, Error>) -> Void
    private var buffer = Data()
    private var response: HTTPURLResponse?
    private var session: URLSession?
    private var finished = false

    init(maximumBytes: Int, allowedOrigin: String, completion: @escaping (Result<NativeHTTPResponse, Error>) -> Void) {
        self.maximumBytes = maximumBytes
        self.allowedOrigin = allowedOrigin
        self.completion = completion
    }

    func start(_ request: URLRequest) {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.timeoutIntervalForRequest = 35
        configuration.timeoutIntervalForResource = 45
        let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        self.session = session
        session.dataTask(with: request).resume()
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard let http = response as? HTTPURLResponse else {
            completionHandler(.cancel)
            finish(.failure(RequestError.invalidResponse))
            return
        }
        if response.expectedContentLength > Int64(maximumBytes) {
            completionHandler(.cancel)
            finish(.failure(RequestError.responseTooLarge))
            return
        }
        self.response = http
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard data.count <= maximumBytes - buffer.count else {
            dataTask.cancel()
            finish(.failure(RequestError.responseTooLarge))
            return
        }
        buffer.append(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            finish(.failure(error))
            return
        }
        guard let response = response, let body = String(data: buffer, encoding: .utf8) else {
            finish(.failure(RequestError.invalidResponse))
            return
        }
        finish(.success(NativeHTTPResponse(status: response.statusCode, body: body)))
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        guard canonicalOrigin(request.url) == allowedOrigin else {
            completionHandler(nil)
            return
        }
        completionHandler(request)
    }

    private func finish(_ result: Result<NativeHTTPResponse, Error>) {
        guard !finished else { return }
        finished = true
        completion(result)
        session?.finishTasksAndInvalidate()
        session = nil
    }

    private func canonicalOrigin(_ url: URL?) -> String {
        guard let url = url, let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "https", let host = components.host?.lowercased() else { return "" }
        return "https://\(host)\((components.port == nil || components.port == 443) ? "" : ":\(components.port!)")"
    }

    private enum RequestError: LocalizedError {
        case invalidResponse, responseTooLarge
        var errorDescription: String? {
            switch self {
            case .invalidResponse: return "Sunucu yanıtı geçersiz."
            case .responseTooLarge: return "Sunucu yanıtı güvenli boyut sınırını aştı."
            }
        }
    }
}
