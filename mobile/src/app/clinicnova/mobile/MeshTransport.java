package app.clinicnova.mobile;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.util.Base64;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;

final class MeshTransport {
    interface Listener {
        String getEnvelope();
        void onEnvelope(String envelope, String peerName);
        void onStatus(String status, String peerName);
    }

    private static final int VERSION = 1;
    private static final int DISCOVERY_PORT = 45872;
    private static final int MAX_FRAME = 64 * 1024 * 1024;
    private static final int MAX_INBOUND_CONNECTIONS = 4;
    private final Context context;
    private final Listener listener;
    private final SecureRandom random = new SecureRandom();
    private final Set<String> connecting = new HashSet<>();
    private final Set<Socket> inboundSockets = new HashSet<>();
    private final Semaphore inboundSlots = new Semaphore(MAX_INBOUND_CONNECTIONS, true);
    private JSONObject config;
    private byte[] secret;
    private volatile boolean running;
    private ServerSocket server;
    private DatagramSocket udp;
    private Timer timer;
    private WifiManager.MulticastLock multicastLock;
    private NsdManager nsdManager;
    private NsdManager.DiscoveryListener discoveryListener;
    private NsdManager.RegistrationListener registrationListener;
    private ExecutorService nsdResolver;
    private ExecutorService inboundExecutor;

    MeshTransport(Context context, Listener listener) { this.context = context; this.listener = listener; }

    synchronized void configure(String json) throws Exception {
        JSONObject next = new JSONObject(json);
        byte[] key = Base64.decode(next.optString("secret"), Base64.DEFAULT);
        String clinicId = next.optString("clinicId");
        String deviceId = next.optString("deviceId");
        String deviceName = next.optString("deviceName");
        if (key.length != 32 || !clinicId.matches("^[A-Za-z0-9_-]{8,128}$") || !deviceId.matches("^[A-Za-z0-9._:-]{8,128}$") || deviceName.isEmpty() || deviceName.length() > 80) {
            throw new IllegalArgumentException("Geçersiz klinik ağı yapılandırması.");
        }
        stop(); config = next; secret = key; start();
    }

    synchronized void start() throws Exception {
        if (config == null || running) return;
        running = true;
        try {
            WifiManager wifi = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) { multicastLock = wifi.createMulticastLock("ClinicNovaMesh"); multicastLock.setReferenceCounted(false); multicastLock.acquire(); }
            server = new ServerSocket(0);
            inboundExecutor = Executors.newFixedThreadPool(MAX_INBOUND_CONNECTIONS);
            new Thread(this::acceptLoop, "clinicnova-mesh-tcp").start();
            startBonjour();
            udp = new DatagramSocket(null); udp.setReuseAddress(true); udp.setBroadcast(true); udp.bind(new java.net.InetSocketAddress(DISCOVERY_PORT));
            new Thread(this::discoveryLoop, "clinicnova-mesh-udp").start();
            timer = new Timer("clinicnova-mesh-announce", true);
            timer.scheduleAtFixedRate(new TimerTask() { @Override public void run() { announce(); } }, 100, 8000);
            listener.onStatus("Yerel ağda eşler aranıyor", "");
        } catch (Exception error) {
            stop();
            throw error;
        }
    }

    private void acceptLoop() {
        while (running) try {
            Socket socket = server.accept();
            ExecutorService executor = inboundExecutor;
            if (!running || executor == null || !inboundSlots.tryAcquire()) { socket.close(); continue; }
            synchronized (inboundSockets) { inboundSockets.add(socket); }
            try {
                executor.execute(() -> {
                    try { accept(socket); }
                    finally {
                        synchronized (inboundSockets) { inboundSockets.remove(socket); }
                        inboundSlots.release();
                    }
                });
            } catch (RuntimeException rejected) {
                synchronized (inboundSockets) { inboundSockets.remove(socket); }
                inboundSlots.release();
                try { socket.close(); } catch (Exception ignored) {}
            }
        } catch (Exception error) { if (running) listener.onStatus("Yerel ağ dinleyicisi: " + message(error), ""); }
    }

    private void discoveryLoop() {
        byte[] buffer = new byte[8192];
        while (running) try {
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length); udp.receive(packet);
            discovered(new String(packet.getData(), packet.getOffset(), packet.getLength(), StandardCharsets.UTF_8), packet.getAddress());
        } catch (Exception error) { if (running) listener.onStatus("Yerel ağ keşfi: " + message(error), ""); }
    }

    private String clinicHash() throws Exception { return hmac("clinic:" + config.getString("clinicId")); }

    private String hmac(String value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return Base64.encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    private JSONObject announcement() throws Exception {
        JSONObject value = new JSONObject(); value.put("v", VERSION); value.put("clinicHash", clinicHash()); value.put("deviceId", config.getString("deviceId"));
        value.put("deviceName", config.optString("deviceName", "Android")); value.put("port", server.getLocalPort());
        byte[] nonce = new byte[12]; random.nextBytes(nonce); value.put("nonce", Base64.encodeToString(nonce, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING));
        value.put("mac", hmac(VERSION + "|" + value.getString("clinicHash") + "|" + value.getString("deviceId") + "|" + value.getString("deviceName") + "|" + value.getInt("port") + "|" + value.getString("nonce")));
        return value;
    }

    synchronized void announce() {
        if (!running) return;
        try { byte[] bytes = announcement().toString().getBytes(StandardCharsets.UTF_8); udp.send(new DatagramPacket(bytes, bytes.length, InetAddress.getByName("255.255.255.255"), DISCOVERY_PORT)); }
        catch (Exception error) { listener.onStatus("Yerel ağ taraması tekrar denenecek", ""); }
    }

    private void discovered(String text, InetAddress address) {
        try {
            JSONObject value = new JSONObject(text);
            discoveredValue(value, address, value.optInt("port"));
        } catch (Exception ignored) { /* Ignore unauthenticated discovery traffic. */ }
    }

    private void discoveredValue(JSONObject value, InetAddress address, int advertisedPort) {
        try {
            if (value.optInt("v") != VERSION || value.optString("deviceId").equals(config.getString("deviceId")) || !MessageDigest.isEqual(value.optString("clinicHash").getBytes(StandardCharsets.UTF_8), clinicHash().getBytes(StandardCharsets.UTF_8))) return;
            String signed = value.getInt("v") + "|" + value.getString("clinicHash") + "|" + value.getString("deviceId") + "|" + value.getString("deviceName") + "|" + value.getInt("port") + "|" + value.getString("nonce");
            if (!MessageDigest.isEqual(value.optString("mac").getBytes(StandardCharsets.UTF_8), hmac(signed).getBytes(StandardCharsets.UTF_8))) return;
            int port = value.getInt("port"); if (port < 1 || port > 65535 || advertisedPort != port) return;
            String key = address.getHostAddress() + ":" + port;
            synchronized (connecting) { if (!connecting.add(key)) return; }
            new Thread(() -> { try { connect(address, port, value.optString("deviceName", "Klinik cihazı")); } finally { synchronized (connecting) { connecting.remove(key); } } }, "clinicnova-mesh-connect").start();
        } catch (Exception ignored) { /* Ignore unauthenticated discovery traffic. */ }
    }

    private void startBonjour() {
        try {
            nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
            if (nsdManager == null) return;
            nsdResolver = Executors.newSingleThreadExecutor();
            JSONObject announcement = announcement();
            NsdServiceInfo info = new NsdServiceInfo();
            info.setServiceName("ClinicNova-" + config.getString("deviceId").substring(Math.max(0, config.getString("deviceId").length() - 16)));
            info.setServiceType("_clinicnova._tcp."); info.setPort(server.getLocalPort());
            java.util.Iterator<String> keys = announcement.keys();
            while (keys.hasNext()) { String key = keys.next(); info.setAttribute(key, String.valueOf(announcement.get(key))); }
            registrationListener = new NsdManager.RegistrationListener() {
                public void onServiceRegistered(NsdServiceInfo serviceInfo) {}
                public void onRegistrationFailed(NsdServiceInfo serviceInfo, int errorCode) { listener.onStatus("Apple cihaz yayını tekrar denenecek", ""); }
                public void onServiceUnregistered(NsdServiceInfo serviceInfo) {}
                public void onUnregistrationFailed(NsdServiceInfo serviceInfo, int errorCode) {}
            };
            nsdManager.registerService(info, NsdManager.PROTOCOL_DNS_SD, registrationListener);
            discoveryListener = new NsdManager.DiscoveryListener() {
                public void onDiscoveryStarted(String serviceType) {}
                public void onServiceFound(NsdServiceInfo serviceInfo) {
                    if (!serviceInfo.getServiceType().startsWith("_clinicnova._tcp")) return;
                    if (nsdResolver == null || nsdResolver.isShutdown()) return;
                    nsdResolver.submit(() -> {
                        CountDownLatch finished = new CountDownLatch(1);
                        try { nsdManager.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                            public void onResolveFailed(NsdServiceInfo value, int errorCode) { finished.countDown(); }
                            public void onServiceResolved(NsdServiceInfo resolved) {
                                try {
                                    JSONObject discovered = new JSONObject();
                                    for (java.util.Map.Entry<String, byte[]> entry : resolved.getAttributes().entrySet()) discovered.put(entry.getKey(), new String(entry.getValue(), StandardCharsets.UTF_8));
                                    discoveredValue(discovered, resolved.getHost(), resolved.getPort());
                                } catch (Exception ignored) {} finally { finished.countDown(); }
                            }
                        }); finished.await(6, TimeUnit.SECONDS); }
                        catch (Exception ignored) { finished.countDown(); }
                    });
                }
                public void onServiceLost(NsdServiceInfo serviceInfo) {}
                public void onDiscoveryStopped(String serviceType) {}
                public void onStartDiscoveryFailed(String serviceType, int errorCode) { try { nsdManager.stopServiceDiscovery(this); } catch (Exception ignored) {} }
                public void onStopDiscoveryFailed(String serviceType, int errorCode) {}
            };
            nsdManager.discoverServices("_clinicnova._tcp.", NsdManager.PROTOCOL_DNS_SD, discoveryListener);
        } catch (Exception error) { listener.onStatus("Apple cihaz keşfi tekrar denenecek", ""); }
    }

    private JSONObject messageObject() throws Exception {
        JSONObject value = new JSONObject(); value.put("v", VERSION); value.put("clinicId", config.getString("clinicId")); value.put("deviceId", config.getString("deviceId")); value.put("deviceName", config.optString("deviceName", "Android"));
        String envelope = listener.getEnvelope(); value.put("envelope", envelope == null || envelope.isEmpty() ? JSONObject.NULL : new JSONObject(envelope)); return value;
    }

    private String encrypt(JSONObject value) throws Exception {
        byte[] iv = new byte[12]; random.nextBytes(iv); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(secret, "AES"), new GCMParameterSpec(128, iv));
        JSONObject outer = new JSONObject(); outer.put("v", VERSION); outer.put("iv", Base64.encodeToString(iv, Base64.NO_WRAP)); outer.put("data", Base64.encodeToString(cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP)); return outer.toString();
    }

    private JSONObject decrypt(String packet) throws Exception {
        JSONObject outer = new JSONObject(packet); byte[] iv = Base64.decode(outer.getString("iv"), Base64.DEFAULT); byte[] data = Base64.decode(outer.getString("data"), Base64.DEFAULT);
        if (outer.optInt("v") != VERSION || iv.length != 12 || data.length < 17 || data.length > MAX_FRAME) throw new IllegalArgumentException("Geçersiz şifreli paket.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(secret, "AES"), new GCMParameterSpec(128, iv)); return new JSONObject(new String(cipher.doFinal(data), StandardCharsets.UTF_8));
    }

    private void writeFrame(Socket socket, String value) throws Exception { byte[] bytes = value.getBytes(StandardCharsets.UTF_8); if (bytes.length > MAX_FRAME) throw new IllegalArgumentException("Eşitleme paketi çok büyük."); DataOutputStream out = new DataOutputStream(socket.getOutputStream()); out.writeInt(bytes.length); out.write(bytes); out.flush(); }
    private String readFrame(Socket socket) throws Exception { socket.setSoTimeout(15000); DataInputStream in = new DataInputStream(socket.getInputStream()); int length = in.readInt(); if (length <= 0 || length > MAX_FRAME) throw new IllegalArgumentException("Geçersiz paket boyutu."); byte[] bytes = new byte[length]; in.readFully(bytes); return new String(bytes, StandardCharsets.UTF_8); }

    private void validateMessage(JSONObject incoming) throws Exception { if (incoming.optInt("v") != VERSION || !incoming.optString("clinicId").equals(config.getString("clinicId")) || incoming.optString("deviceId").equals(config.getString("deviceId"))) throw new IllegalArgumentException("Klinik ağı eşleşmiyor."); }
    private void deliver(JSONObject incoming, String fallback) { JSONObject envelope = incoming.optJSONObject("envelope"); String peer = incoming.optString("deviceName", fallback); if (envelope != null) listener.onEnvelope(envelope.toString(), peer); listener.onStatus("Yerel eşitleme tamamlandı", peer); }

    private void accept(Socket socket) {
        try { JSONObject incoming = decrypt(readFrame(socket)); validateMessage(incoming); writeFrame(socket, encrypt(messageObject())); deliver(incoming, "Klinik cihazı"); }
        catch (Exception error) { listener.onStatus("Eşitleme reddedildi: " + message(error), ""); }
        finally { try { socket.close(); } catch (Exception ignored) {} }
    }

    private void connect(InetAddress address, int port, String peerName) {
        Socket socket = new Socket();
        try { socket.connect(new java.net.InetSocketAddress(address, port), 10000); writeFrame(socket, encrypt(messageObject())); JSONObject incoming = decrypt(readFrame(socket)); validateMessage(incoming); deliver(incoming, peerName); }
        catch (Exception error) { listener.onStatus("Eşitleme tekrar denenecek: " + message(error), peerName); }
        finally { try { socket.close(); } catch (Exception ignored) {} }
    }

    synchronized void stop() {
        running = false; if (timer != null) timer.cancel(); timer = null;
        try { if (nsdManager != null && discoveryListener != null) nsdManager.stopServiceDiscovery(discoveryListener); } catch (Exception ignored) {}
        try { if (nsdManager != null && registrationListener != null) nsdManager.unregisterService(registrationListener); } catch (Exception ignored) {}
        discoveryListener = null; registrationListener = null; nsdManager = null;
        if (nsdResolver != null) nsdResolver.shutdownNow(); nsdResolver = null;
        if (inboundExecutor != null) inboundExecutor.shutdownNow(); inboundExecutor = null;
        synchronized (inboundSockets) {
            for (Socket socket : inboundSockets) try { socket.close(); } catch (Exception ignored) {}
            inboundSockets.clear();
        }
        try { if (udp != null) udp.close(); } catch (Exception ignored) {} try { if (server != null) server.close(); } catch (Exception ignored) {}
        udp = null; server = null; synchronized (connecting) { connecting.clear(); }
        if (multicastLock != null && multicastLock.isHeld()) multicastLock.release(); multicastLock = null;
        config = null;
        if (secret != null) Arrays.fill(secret, (byte) 0);
        secret = null;
    }

    private static String message(Exception error) { return error.getMessage() == null ? "bilinmeyen hata" : error.getMessage(); }
}
