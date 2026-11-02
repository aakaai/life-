import Foundation
import Capacitor
import ActivityKit
import UserNotifications

// Pont entre la page web et iOS pour le chrono de repos :
//   RestActivity.show({ title, endsAt, total, next, detail }) → île dynamique + écran verrouillé
//   RestActivity.hide() → retire le chrono et la notification prévue
@objc(RestActivityPlugin)
public class RestActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestActivityPlugin"
    public let jsName = "RestActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]

    private let notificationId = "life.rest.end"

    override public func load() {
        // Un chrono resté affiché (app fermée pendant une séance) est retiré au lancement.
        Task { await RestActivityPlugin.endAll() }
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve([
            "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
            "running": !Activity<RestActivityAttributes>.activities.isEmpty
        ])
    }

    @objc func show(_ call: CAPPluginCall) {
        guard let endsAtMs = call.getDouble("endsAt") else {
            call.reject("endsAt manquant")
            return
        }
        let endsAt = Date(timeIntervalSince1970: endsAtMs / 1000)
        let total = max(1, call.getDouble("total") ?? endsAt.timeIntervalSinceNow)
        let state = RestActivityAttributes.ContentState(
            startedAt: endsAt.addingTimeInterval(-total),
            endsAt: endsAt,
            next: call.getString("next") ?? "",
            detail: call.getString("detail") ?? ""
        )
        let title = call.getString("title") ?? "Séance"
        let notify = call.getBool("notify") ?? true

        Task {
            await RestActivityPlugin.startOrUpdate(title: title, state: state)
            if notify {
                await self.scheduleEndNotification(at: endsAt, next: state.next)
            }
            call.resolve()
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [notificationId])
        Task {
            await RestActivityPlugin.endAll()
            call.resolve()
        }
    }

    // MARK: - Live Activity

    private static func startOrUpdate(title: String, state: RestActivityAttributes.ContentState) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let content = ActivityContent(state: state, staleDate: state.endsAt.addingTimeInterval(10 * 60))
        let running = Activity<RestActivityAttributes>.activities
        if let current = running.first, current.attributes.title == title {
            await current.update(content)
            return
        }
        for activity in running {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        do {
            _ = try Activity<RestActivityAttributes>.request(
                attributes: RestActivityAttributes(title: title),
                content: content,
                pushType: nil
            )
        } catch {
            print("Life – chrono de repos impossible : \(error)")
        }
    }

    private static func endAll() async {
        for activity in Activity<RestActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    // MARK: - Notification de fin de repos (sonne même téléphone verrouillé)

    private func scheduleEndNotification(at date: Date, next: String) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notificationId])

        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .sound])
        }

        let interval = date.timeIntervalSinceNow
        guard interval > 1 else { return }

        let content = UNMutableNotificationContent()
        content.title = "Repos terminé"
        content.body = next.isEmpty ? "C’est reparti !" : "C’est reparti : \(next)"
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let request = UNNotificationRequest(identifier: notificationId, content: content, trigger: trigger)
        try? await center.add(request)
    }
}
