import UIKit
import Capacitor
import WebKit
import WidgetKit

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
