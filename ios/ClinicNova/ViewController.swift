import UIKit
import WebKit

final class ViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private let store = SecureMeshStore()
    private var localRecords: [String: String] = [:]
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
        if let data = store.read("records").data(using: .utf8), let values = try? JSONDecoder().decode([String: String].self, from: data) { localRecords = values }
        for name in ["meshConfigure", "meshPublish", "meshSyncNow", "meshDisable", "storageSet"] { content.add(self, name: name) }
        content.addUserScript(WKUserScript(source: nativeBridgeScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = content
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
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
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html") else { return }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    deinit {
        mesh.stop()
        for name in ["meshConfigure", "meshPublish", "meshSyncNow", "meshDisable", "storageSet"] { webView?.configuration.userContentController.removeScriptMessageHandler(forName: name) }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame else { return }
        switch message.name {
        case "meshConfigure":
            guard let value = message.body as? String, value.utf8.count <= 8192, store.write("config", value: value) else { return }
            try? mesh.configure(value)
        case "meshPublish":
            guard let value = message.body as? String, value.utf8.count <= 64 * 1024 * 1024 else { return }
            _ = store.write("envelope", value: value)
        case "meshSyncNow": mesh.syncNow()
        case "meshDisable": mesh.stop(); store.clearMesh()
        case "storageSet":
            guard let value = message.body as? [String: Any], let key = value["key"] as? String, let stored = value["value"] as? String,
                  key.range(of: "^clinicnova\\.[A-Za-z0-9._-]{1,80}$", options: .regularExpression) != nil,
                  stored.utf8.count <= 64 * 1024 * 1024 else { return }
            localRecords[key] = stored
            if let data = try? JSONEncoder().encode(localRecords), let text = String(data: data, encoding: .utf8) { _ = store.write("records", value: text) }
        default: break
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
        if url.isFileURL || url.scheme == "about" { return decisionHandler(.allow) }
        if url.scheme == "https" { UIApplication.shared.open(url); return decisionHandler(.cancel) }
        decisionHandler(.cancel)
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

    private func nativeBridgeScript() -> String {
        let config = jsonString(store.read("config"))
        let envelope = jsonString(store.read("envelope"))
        let records = (try? JSONSerialization.data(withJSONObject: localRecords, options: [.sortedKeys])).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        return """
        window.__clinicNovaIOSConfig = \(config);
        window.__clinicNovaIOSEnvelope = \(envelope);
        window.__clinicNovaIOSRecords = \(records);
        window.ClinicNovaNative = Object.freeze({
          platform: "ios",
          storageGet: function(key){ return Object.prototype.hasOwnProperty.call(window.__clinicNovaIOSRecords,key) ? window.__clinicNovaIOSRecords[key] : null; },
          storageSet: function(key,value){ window.__clinicNovaIOSRecords[key] = value; window.webkit.messageHandlers.storageSet.postMessage({key:key,value:value}); return true; },
          meshGetConfig: function(){ return window.__clinicNovaIOSConfig || ""; },
          meshGetEnvelope: function(){ return window.__clinicNovaIOSEnvelope || ""; },
          meshConfigure: function(value){ window.__clinicNovaIOSConfig = value; window.webkit.messageHandlers.meshConfigure.postMessage(value); return true; },
          meshPublish: function(value){ window.__clinicNovaIOSEnvelope = value; window.webkit.messageHandlers.meshPublish.postMessage(value); return true; },
          meshSyncNow: function(){ window.webkit.messageHandlers.meshSyncNow.postMessage(""); },
          meshDisable: function(){ window.__clinicNovaIOSConfig = ""; window.__clinicNovaIOSEnvelope = ""; window.webkit.messageHandlers.meshDisable.postMessage(""); return true; }
        });
        """
    }

    private func call(_ function: String, _ first: String, _ second: String) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("window.\(function) && window.\(function)(\(self?.jsonString(first) ?? "null"),\(self?.jsonString(second) ?? "null"))")
        }
    }

    private func jsonString(_ value: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [value])
        let array = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(array.dropFirst().dropLast())
    }
}
