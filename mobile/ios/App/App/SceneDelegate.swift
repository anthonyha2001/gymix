import UIKit
import Capacitor
import WebKit
import WidgetKit
import CoreNFC

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GymixViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// The Gymix screen: Capacitor's web view, plus two permissions answered once
// for the Gymix website instead of asking every visit:
//   * motion (shake to open programs, the dropped-phone animation)
//   * camera (QR scanner, progress photos); iOS still asks the first time.
// Everything else goes to Capacitor's own handler unchanged.
final class GymixViewController: CAPBridgeViewController {
    private var uiProxy: GymixUIDelegate?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(GymixWidgetPlugin())
        bridge?.registerPluginInstance(GymixNfcPlugin())
        guard let webView = webView else { return }
        let proxy = GymixUIDelegate(original: webView.uiDelegate)
        uiProxy = proxy
        webView.uiDelegate = proxy
    }
}

final class GymixUIDelegate: NSObject, WKUIDelegate {
    private weak var original: WKUIDelegate?
    // The Gymix website's host (GymixHost in Info.plist, set by npm run sync).
    private let gymixHost = Bundle.main.object(forInfoDictionaryKey: "GymixHost") as? String

    init(original: WKUIDelegate?) {
        self.original = original
    }

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || (original?.responds(to: aSelector) ?? false)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if !super.responds(to: aSelector), original?.responds(to: aSelector) == true { return original }
        return super.forwardingTarget(for: aSelector)
    }

    private func isGymix(_ origin: WKSecurityOrigin) -> Bool {
        gymixHost != nil && origin.host == gymixHost
    }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView,
                 requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(isGymix(origin) ? .grant : .prompt)
    }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(isGymix(origin) ? .grant : .prompt)
    }
}

// "GymixWidget" in JavaScript: the app hands the home-screen widget where to
// ask for its data and the person's widget token, through the App Group both
// share (group.com.gymix.app), then asks it to refresh.
@objc(GymixWidgetPlugin)
public class GymixWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GymixWidgetPlugin"
    public let jsName = "GymixWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
    ]
    static let group = "group.com.gymix.app"

    @objc func connect(_ call: CAPPluginCall) {
        guard let url = call.getString("url"), let token = call.getString("token") else {
            call.reject("url and token are required")
            return
        }
        let defaults = UserDefaults(suiteName: Self.group)
        defaults?.set(url, forKey: "url")
        defaults?.set(token, forKey: "token")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: Self.group)
        defaults?.removeObject(forKey: "url")
        defaults?.removeObject(forKey: "token")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

// "GymixNfc" in JavaScript (web/src/lib/nfc.ts): writes a link onto a blank NFC
// sticker, so staff never need another app. iPhone 7 and newer. Needs the
// "NFC Tag Reading" capability (App.entitlements) and NFCReaderUsageDescription.
// Rejections carry a code the website turns into a message: cancelled,
// unavailable, disabled, locked, failed.
@objc(GymixNfcPlugin)
public class GymixNfcPlugin: CAPPlugin, CAPBridgedPlugin, NFCNDEFReaderSessionDelegate {
    public let identifier = "GymixNfcPlugin"
    public let jsName = "GymixNfc"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
    ]

    private var session: NFCNDEFReaderSession?
    private var pending: CAPPluginCall?
    private var message: NFCNDEFMessage?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": NFCNDEFReaderSession.readingAvailable, "enabled": NFCNDEFReaderSession.readingAvailable])
    }

    @objc func writeUrl(_ call: CAPPluginCall) {
        guard NFCNDEFReaderSession.readingAvailable else {
            call.reject("This iPhone can't write NFC stickers", "unavailable")
            return
        }
        guard let text = call.getString("url"), let url = URL(string: text),
              let record = NFCNDEFPayload.wellKnownTypeURIPayload(url: url) else {
            call.reject("A valid url is required", "failed")
            return
        }
        DispatchQueue.main.async {
            self.session?.invalidate()
            self.session = nil
            self.finish(code: "cancelled", text: "Replaced by a new write")
            self.message = NFCNDEFMessage(records: [record])
            self.pending = call
            let session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: false)
            session.alertMessage = "Hold the top of your iPhone on the sticker."
            self.session = session
            session.begin()
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.session?.invalidate()
            self.session = nil
            self.finish(code: "cancelled", text: "Cancelled")
            call.resolve()
        }
    }

    // Resolves (code nil) or rejects the waiting write, once.
    private func finish(code: String?, text: String?) {
        guard let call = pending else { return }
        pending = nil
        message = nil
        if let code = code { call.reject(text ?? code, code) } else { call.resolve() }
    }

    public func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {}

    public func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
        guard let message = message else { return }
        if tags.count > 1 {
            session.alertMessage = "More than one sticker. Hold just one."
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) { session.restartPolling() }
            return
        }
        let tag = tags[0]
        session.connect(to: tag) { error in
            if error != nil {
                session.alertMessage = "Couldn't reach the sticker. Hold still and try again."
                session.restartPolling()
                return
            }
            tag.queryNDEFStatus { status, capacity, error in
                if error != nil {
                    DispatchQueue.main.async { self.finish(code: "failed", text: "Couldn't read the sticker") }
                    session.invalidate(errorMessage: "Couldn't read the sticker. Try again.")
                    return
                }
                switch status {
                case .notSupported:
                    DispatchQueue.main.async { self.finish(code: "failed", text: "This sticker can't hold a link") }
                    session.invalidate(errorMessage: "This sticker can't hold a link.")
                case .readOnly:
                    DispatchQueue.main.async { self.finish(code: "locked", text: "This sticker is locked") }
                    session.invalidate(errorMessage: "This sticker is locked.")
                case .readWrite:
                    if capacity < message.length {
                        DispatchQueue.main.async { self.finish(code: "failed", text: "The link doesn't fit on this sticker") }
                        session.invalidate(errorMessage: "The link doesn't fit on this sticker.")
                        return
                    }
                    tag.writeNDEF(message) { error in
                        if error != nil {
                            DispatchQueue.main.async { self.finish(code: "failed", text: "Couldn't write the sticker") }
                            session.invalidate(errorMessage: "Couldn't write. Try again.")
                        } else {
                            DispatchQueue.main.async { self.finish(code: nil, text: nil) }
                            session.alertMessage = "Sticker written."
                            session.invalidate()
                        }
                    }
                @unknown default:
                    DispatchQueue.main.async { self.finish(code: "failed", text: "Couldn't write the sticker") }
                    session.invalidate(errorMessage: "Couldn't write. Try again.")
                }
            }
        }
    }

    // Closing the sheet (Cancel, timeout, or after writing) ends the session.
    public func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        DispatchQueue.main.async {
            // A session that was already replaced or cancelled has nothing left to report.
            guard self.session === session else { return }
            self.session = nil
            let code = (error as? NFCReaderError)?.code
            let cancelled = code == .readerSessionInvalidationErrorUserCanceled || code == .readerSessionInvalidationErrorSessionTimeout
            self.finish(code: cancelled ? "cancelled" : "failed", text: error.localizedDescription)
        }
    }
}
