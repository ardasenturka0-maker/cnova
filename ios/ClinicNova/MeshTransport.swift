import CryptoKit
import Darwin
import Foundation
import Security

final class MeshTransport: NSObject, NetServiceDelegate, NetServiceBrowserDelegate {
    private struct Configuration: Codable {
        let clinicId: String
        let secret: String
        let deviceId: String
        let deviceName: String
    }

    private let protocolVersion = 1
    private let maximumFrame = 64 * 1024 * 1024
    private let maximumInboundConnections = 4
    private let queue = DispatchQueue(label: "app.clinicnova.mesh.control")
    private let workers = DispatchQueue(label: "app.clinicnova.mesh.workers", attributes: .concurrent)
    private let peerLock = NSLock()
    private var activePeers = Set<String>()
    private var activeInboundSockets = Set<Int32>()
    private var configuration: Configuration?
    private var clinicKey: SymmetricKey?
    private var tcpSocket: Int32 = -1
    private var tcpSource: DispatchSourceRead?
    private var publishedService: NetService?
    private var browser: NetServiceBrowser?
    private var resolvingServices: [NetService] = []
    private var tcpPort: UInt16 = 0
    private var running = false
    private let getEnvelope: () -> String
    private let onEnvelope: (String, String) -> Void
    private let onStatus: (String, String) -> Void

    init(getEnvelope: @escaping () -> String, onEnvelope: @escaping (String, String) -> Void, onStatus: @escaping (String, String) -> Void) {
        self.getEnvelope = getEnvelope
        self.onEnvelope = onEnvelope
        self.onStatus = onStatus
        super.init()
    }

    func configure(_ json: String) throws {
        let value = try JSONDecoder().decode(Configuration.self, from: Data(json.utf8))
        guard value.clinicId.range(of: "^[A-Za-z0-9_-]{8,128}$", options: .regularExpression) != nil,
              value.deviceId.range(of: "^[A-Za-z0-9._:-]{8,128}$", options: .regularExpression) != nil,
              let secret = Data(base64Encoded: value.secret), secret.count == 32 else { throw MeshError.invalidConfiguration }
        try queue.sync {
            stopLocked()
            configuration = value
            clinicKey = SymmetricKey(data: secret)
            do {
                try startLocked()
            } catch {
                stopLocked()
                configuration = nil
                clinicKey = nil
                throw error
            }
        }
    }

    func syncNow() {
        onStatus("Android, iPhone, Windows ve Mac cihazları yeniden taranıyor", "")
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.browser?.stop()
            let browser = NetServiceBrowser(); browser.delegate = self; self.browser = browser
            browser.searchForServices(ofType: "_clinicnova._tcp.", inDomain: "local.")
        }
    }
    func stop() { queue.sync { stopLocked(); configuration = nil; clinicKey = nil } }

    private func startLocked() throws {
        guard configuration != nil, clinicKey != nil else { return }
        tcpSocket = Darwin.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)
        guard tcpSocket >= 0 else { throw MeshError.socketFailure }
        var enabled: Int32 = 1
        setsockopt(tcpSocket, SOL_SOCKET, SO_REUSEADDR, &enabled, socklen_t(MemoryLayout<Int32>.size))
        setsockopt(tcpSocket, SOL_SOCKET, SO_NOSIGPIPE, &enabled, socklen_t(MemoryLayout<Int32>.size))
        var tcpAddress = socketAddress(port: 0, address: INADDR_ANY)
        guard bindSocket(tcpSocket, address: &tcpAddress) == 0, listen(tcpSocket, 16) == 0 else { throw MeshError.bindFailure }
        var bound = sockaddr_in(); var boundLength = socklen_t(MemoryLayout<sockaddr_in>.size)
        withUnsafeMutablePointer(to: &bound) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { _ = getsockname(tcpSocket, $0, &boundLength) }
        }
        tcpPort = UInt16(bigEndian: bound.sin_port)
        running = true
        let tcpSource = DispatchSource.makeReadSource(fileDescriptor: tcpSocket, queue: queue)
        tcpSource.setEventHandler { [weak self] in self?.acceptLocked() }
        tcpSource.resume(); self.tcpSource = tcpSource
        startBonjourLocked()
        onStatus("Yerel ağda Android, iPhone, Windows ve Mac cihazları aranıyor", "")
    }

    private func stopLocked() {
        running = false
        tcpSource?.cancel(); tcpSource = nil
        if tcpSocket >= 0 { Darwin.close(tcpSocket); tcpSocket = -1 }
        DispatchQueue.main.async { [weak self] in
            self?.browser?.stop(); self?.browser = nil
            self?.publishedService?.stop(); self?.publishedService = nil
            self?.resolvingServices.removeAll()
        }
        tcpPort = 0
        peerLock.lock()
        for socket in activeInboundSockets { Darwin.shutdown(socket, SHUT_RDWR) }
        peerLock.unlock()
        peerLock.lock(); activePeers.removeAll(); peerLock.unlock()
    }

    private func discoveryFields() throws -> [String: String] {
        guard let config = configuration else { throw MeshError.invalidConfiguration }
        var nonce = Data(count: 12)
        guard nonce.withUnsafeMutableBytes({ SecRandomCopyBytes(kSecRandomDefault, 12, $0.baseAddress!) }) == errSecSuccess else { throw MeshError.cryptoFailure }
        let hash = try hmac("clinic:\(config.clinicId)")
        let nonceText = nonce.base64URL
        let deviceName = String(config.deviceName.prefix(80))
        let signed = "\(protocolVersion)|\(hash)|\(config.deviceId)|\(deviceName)|\(tcpPort)|\(nonceText)"
        return ["v": String(protocolVersion), "clinicHash": hash, "deviceId": config.deviceId, "deviceName": deviceName, "port": String(tcpPort), "nonce": nonceText, "mac": try hmac(signed)]
    }

    private func startBonjourLocked() {
        guard let config = configuration, let fields = try? discoveryFields() else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let service = NetService(domain: "local.", type: "_clinicnova._tcp.", name: "ClinicNova-\(config.deviceId.suffix(16))", port: Int32(self.tcpPort))
            service.delegate = self
            service.setTXTRecord(NetService.data(fromTXTRecord: fields.mapValues { Data($0.utf8) }))
            service.publish(); self.publishedService = service
            let browser = NetServiceBrowser(); browser.delegate = self; self.browser = browser
            browser.searchForServices(ofType: "_clinicnova._tcp.", inDomain: "local.")
        }
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        guard service.name != publishedService?.name else { return }
        resolvingServices.append(service); service.delegate = self; service.resolve(withTimeout: 5)
    }

    func netServiceDidResolveAddress(_ sender: NetService) {
        defer { resolvingServices.removeAll { $0 === sender } }
        guard let data = sender.txtRecordData() else { return }
        let fields = NetService.dictionary(fromTXTRecord: data).mapValues { String(data: $0, encoding: .utf8) ?? "" }
        guard let config = configuration,
              sender.port > 0, sender.port <= 65_535,
              Int(fields["v"] ?? "") == protocolVersion,
              let deviceId = fields["deviceId"], deviceId != config.deviceId,
              let hash = fields["clinicHash"], secureEqual(hash, (try? hmac("clinic:\(config.clinicId)")) ?? ""),
              let deviceName = fields["deviceName"], let nonce = fields["nonce"], let mac = fields["mac"],
              let fieldPort = UInt16(fields["port"] ?? ""), fieldPort == UInt16(sender.port), fieldPort > 0 else { return }
        let signed = "\(protocolVersion)|\(hash)|\(deviceId)|\(deviceName)|\(fieldPort)|\(nonce)"
        guard secureEqual(mac, (try? hmac(signed)) ?? "") else { return }
        for address in sender.addresses ?? [] {
            if let host = ipv4(address) { connect(host: host, port: fieldPort, peerName: deviceName); return }
        }
    }

    func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) { resolvingServices.removeAll { $0 === sender } }

    private func acceptLocked() {
        let client = Darwin.accept(tcpSocket, nil, nil)
        guard client >= 0 else { return }
        peerLock.lock()
        let accepted = activeInboundSockets.count < maximumInboundConnections
        if accepted { activeInboundSockets.insert(client) }
        peerLock.unlock()
        guard accepted else { Darwin.close(client); return }
        workers.async { [weak self] in
            guard let self = self else { Darwin.close(client); return }
            defer {
                self.peerLock.lock(); self.activeInboundSockets.remove(client); self.peerLock.unlock()
            }
            self.serve(client)
        }
    }

    private func connect(host: String, port: UInt16, peerName: String) {
        let identity = "\(host):\(port)"
        peerLock.lock(); let inserted = activePeers.insert(identity).inserted; peerLock.unlock()
        guard inserted else { return }
        workers.async { [weak self] in
            defer { self?.peerLock.lock(); self?.activePeers.remove(identity); self?.peerLock.unlock() }
            self?.connectWorker(host: host, port: port, peerName: peerName)
        }
    }

    private func serve(_ client: Int32) {
        defer { Darwin.close(client) }
        configureClientSocket(client)
        do {
            let incoming = try decrypt(try readFrame(client))
            try validateMessage(incoming)
            try writeFrame(client, data: try encrypt(try messageObject()))
            deliver(incoming, fallback: "Klinik cihazı")
        } catch { onStatus("Eşitleme reddedildi: \(error.localizedDescription)", "") }
    }

    private func connectWorker(host: String, port: UInt16, peerName: String) {
        let client = Darwin.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)
        guard client >= 0 else { return }
        defer { Darwin.close(client) }
        configureClientSocket(client)
        var raw = in_addr(); guard inet_pton(AF_INET, host, &raw) == 1 else { return }
        var address = socketAddress(port: port, address: raw.s_addr)
        let result = withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.connect(client, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) }
        }
        guard result == 0 else { onStatus("Eşitleme yeniden denenecek", peerName); return }
        do {
            try writeFrame(client, data: try encrypt(try messageObject()))
            let incoming = try decrypt(try readFrame(client))
            try validateMessage(incoming)
            deliver(incoming, fallback: peerName)
        } catch { onStatus("Eşitleme yeniden denenecek: \(error.localizedDescription)", peerName) }
    }

    private func messageObject() throws -> [String: Any] {
        guard let config = configuration else { throw MeshError.invalidConfiguration }
        var value: [String: Any] = ["v": protocolVersion, "clinicId": config.clinicId, "deviceId": config.deviceId, "deviceName": config.deviceName]
        let envelope = getEnvelope()
        value["envelope"] = envelope.isEmpty ? NSNull() : try JSONSerialization.jsonObject(with: Data(envelope.utf8))
        return value
    }

    private func validateMessage(_ value: [String: Any]) throws {
        guard let config = configuration,
              (value["v"] as? NSNumber)?.intValue == protocolVersion,
              value["clinicId"] as? String == config.clinicId,
              let device = value["deviceId"] as? String, device != config.deviceId else { throw MeshError.wrongClinic }
    }

    private func deliver(_ value: [String: Any], fallback: String) {
        let peer = (value["deviceName"] as? String) ?? fallback
        if let envelope = value["envelope"], !(envelope is NSNull),
           let data = try? JSONSerialization.data(withJSONObject: envelope),
           let text = String(data: data, encoding: .utf8) { onEnvelope(text, peer) }
        onStatus("Yerel eşitleme tamamlandı", peer)
    }

    private func encrypt(_ value: [String: Any]) throws -> Data {
        guard let key = clinicKey else { throw MeshError.cryptoFailure }
        let clear = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
        let sealed = try AES.GCM.seal(clear, using: key)
        var combined = sealed.ciphertext; combined.append(sealed.tag)
        return try JSONSerialization.data(withJSONObject: ["v": protocolVersion, "iv": sealed.nonce.data.base64EncodedString(), "data": combined.base64EncodedString()], options: [.sortedKeys])
    }

    private func decrypt(_ packet: Data) throws -> [String: Any] {
        guard let key = clinicKey,
              let outer = try JSONSerialization.jsonObject(with: packet) as? [String: Any],
              (outer["v"] as? NSNumber)?.intValue == protocolVersion,
              let ivText = outer["iv"] as? String, let iv = Data(base64Encoded: ivText), iv.count == 12,
              let dataText = outer["data"] as? String, let combined = Data(base64Encoded: dataText), combined.count >= 17, combined.count <= maximumFrame else { throw MeshError.cryptoFailure }
        let nonce = try AES.GCM.Nonce(data: iv)
        let ciphertext = combined.dropLast(16); let tag = combined.suffix(16)
        let box = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
        let clear = try AES.GCM.open(box, using: key)
        guard let value = try JSONSerialization.jsonObject(with: clear) as? [String: Any] else { throw MeshError.invalidFrame }
        return value
    }

    private func hmac(_ value: String) throws -> String {
        guard let key = clinicKey else { throw MeshError.cryptoFailure }
        return Data(HMAC<SHA256>.authenticationCode(for: Data(value.utf8), using: key)).base64URL
    }

    private func readFrame(_ socket: Int32) throws -> Data {
        let header = try readExact(socket, count: 4)
        let bytes = [UInt8](header)
        let length = Int(UInt32(bytes[0]) << 24 | UInt32(bytes[1]) << 16 | UInt32(bytes[2]) << 8 | UInt32(bytes[3]))
        guard length > 0, length <= maximumFrame else { throw MeshError.invalidFrame }
        return try readExact(socket, count: length)
    }

    private func writeFrame(_ socket: Int32, data: Data) throws {
        guard data.count > 0, data.count <= maximumFrame else { throw MeshError.invalidFrame }
        let length = UInt32(data.count)
        var packet = Data([UInt8(length >> 24), UInt8((length >> 16) & 255), UInt8((length >> 8) & 255), UInt8(length & 255)])
        packet.append(data)
        var sent = 0
        try packet.withUnsafeBytes { buffer in
            while sent < packet.count {
                let count = Darwin.send(socket, buffer.baseAddress!.advanced(by: sent), packet.count - sent, 0)
                if count <= 0 { throw MeshError.connectionClosed }
                sent += count
            }
        }
    }

    private func readExact(_ socket: Int32, count: Int) throws -> Data {
        var result = Data(count: count); var received = 0
        try result.withUnsafeMutableBytes { buffer in
            while received < count {
                let amount = Darwin.recv(socket, buffer.baseAddress!.advanced(by: received), count - received, 0)
                if amount <= 0 { throw MeshError.connectionClosed }
                received += amount
            }
        }
        return result
    }

    private func configureClientSocket(_ socket: Int32) {
        var enabled: Int32 = 1
        setsockopt(socket, SOL_SOCKET, SO_NOSIGPIPE, &enabled, socklen_t(MemoryLayout<Int32>.size))
        var timeout = timeval(tv_sec: 15, tv_usec: 0)
        setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
        setsockopt(socket, SOL_SOCKET, SO_SNDTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
    }

    private func socketAddress(port: UInt16, address: in_addr_t) -> sockaddr_in {
        var value = sockaddr_in(); value.sin_len = UInt8(MemoryLayout<sockaddr_in>.size); value.sin_family = sa_family_t(AF_INET)
        value.sin_port = port.bigEndian; value.sin_addr = in_addr(s_addr: address); return value
    }

    private func bindSocket(_ socket: Int32, address: inout sockaddr_in) -> Int32 {
        withUnsafePointer(to: &address) { pointer in pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(socket, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } }
    }

    private func ipv4(_ address: in_addr) -> String? {
        var value = address; var buffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
        guard inet_ntop(AF_INET, &value, &buffer, socklen_t(INET_ADDRSTRLEN)) != nil else { return nil }
        return String(cString: buffer)
    }

    private func ipv4(_ data: Data) -> String? {
        guard data.count >= MemoryLayout<sockaddr>.size else { return nil }
        return data.withUnsafeBytes { buffer in
            guard let base = buffer.baseAddress else { return nil }
            let family = base.assumingMemoryBound(to: sockaddr.self).pointee.sa_family
            guard family == sa_family_t(AF_INET), data.count >= MemoryLayout<sockaddr_in>.size else { return nil }
            return ipv4(base.assumingMemoryBound(to: sockaddr_in.self).pointee.sin_addr)
        }
    }

    private func secureEqual(_ left: String, _ right: String) -> Bool {
        let a = [UInt8](left.utf8), b = [UInt8](right.utf8); guard a.count == b.count else { return false }
        var difference: UInt8 = 0; for index in a.indices { difference |= a[index] ^ b[index] }; return difference == 0
    }

    private enum MeshError: LocalizedError {
        case invalidConfiguration, socketFailure, bindFailure, cryptoFailure, invalidFrame, wrongClinic, connectionClosed
        var errorDescription: String? {
            switch self {
            case .invalidConfiguration: return "Klinik ağı yapılandırması geçersiz."
            case .socketFailure, .bindFailure: return "Yerel ağ soketi açılamadı."
            case .cryptoFailure: return "Şifreli paket doğrulanamadı."
            case .invalidFrame: return "Eşitleme paketi geçersiz."
            case .wrongClinic: return "Klinik ağı eşleşmiyor."
            case .connectionClosed: return "Bağlantı aktarım sırasında kesildi."
            }
        }
    }
}

private extension Data {
    var base64URL: String { base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
}

private extension AES.GCM.Nonce {
    var data: Data { withUnsafeBytes { Data($0) } }
}
