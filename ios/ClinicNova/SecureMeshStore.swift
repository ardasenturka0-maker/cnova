import CryptoKit
import Foundation
import Security

final class SecureMeshStore {
    private let service = "app.clinicnova.ios.mesh"
    private let account = "local-encryption-key-v1"
    private let directory: URL

    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        directory = base.appendingPathComponent("ClinicNova", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutableDirectory = directory
        try? mutableDirectory.setResourceValues(values)
    }

    func read(_ name: String) -> String {
        guard let encrypted = try? Data(contentsOf: file(name)),
              let box = try? AES.GCM.SealedBox(combined: encrypted),
              let clear = try? AES.GCM.open(box, using: key()),
              let value = String(data: clear, encoding: .utf8) else { return "" }
        return value
    }

    @discardableResult
    func write(_ name: String, value: String) -> Bool {
        do {
            let box = try AES.GCM.seal(Data(value.utf8), using: key())
            guard let combined = box.combined else { return false }
            try combined.write(to: file(name), options: [.atomic, .completeFileProtection])
            return true
        } catch { return false }
    }

    func clearMesh() {
        try? FileManager.default.removeItem(at: file("config"))
        try? FileManager.default.removeItem(at: file("envelope"))
    }

    private func file(_ name: String) -> URL {
        directory.appendingPathComponent("mesh-\(name).bin")
    }

    private func key() throws -> SymmetricKey {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data, data.count == 32 {
            return SymmetricKey(data: data)
        }
        var bytes = Data(count: 32)
        let status = bytes.withUnsafeMutableBytes { buffer in
            SecRandomCopyBytes(kSecRandomDefault, 32, buffer.baseAddress!)
        }
        guard status == errSecSuccess else { throw StoreError.keyGeneration }
        let add: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData: bytes
        ]
        guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw StoreError.keyStorage }
        return SymmetricKey(data: bytes)
    }

    private enum StoreError: Error { case keyGeneration, keyStorage }
}
