import UIKit
import Capacitor
import WebKit

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
