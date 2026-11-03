import Foundation
import Capacitor
import UserNotifications

// Rappels d'habitudes (notifications locales, sans serveur) :
//   HabitReminders.sync({ items: [{ id, habitId, date, time, title, body }] })
//     → remplace tous les rappels prévus par ceux-ci (au plus 60, iOS en garde 64)
//   HabitReminders.takePending() → actions « Fait » / « ouvrir » en attente
//   HabitReminders.permission() → demande l'autorisation si besoin
//   événement « habitAction » quand une action arrive pendant que l'app tourne
@objc(HabitRemindersPlugin)
public class HabitRemindersPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HabitRemindersPlugin"
    public let jsName = "HabitReminders"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "permission", returnType: CAPPluginReturnPromise)
    ]

    private let prefix = "life.habit."

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(actionReceived), name: LifeNotifications.actionReceived, object: nil)
    }

    @objc private func actionReceived() {
        notifyListeners("habitAction", data: [:])
    }

    @objc func takePending(_ call: CAPPluginCall) {
        let actions: [JSValue] = LifeNotifications.takePending().map { item in
            var obj = JSObject()
            for (k, v) in item { obj[k] = v }
            return obj
        }
        call.resolve(["actions": actions])
    }

    @objc func permission(_ call: CAPPluginCall) {
        Task {
            let center = UNUserNotificationCenter.current()
            var settings = await center.notificationSettings()
            if settings.authorizationStatus == .notDetermined {
                _ = try? await center.requestAuthorization(options: [.alert, .sound])
                settings = await center.notificationSettings()
            }
            call.resolve(["status": Self.statusName(settings.authorizationStatus)])
        }
    }

    @objc func sync(_ call: CAPPluginCall) {
        let items = call.getArray("items", JSObject.self) ?? []
        let prefix = self.prefix
        Task {
            let center = UNUserNotificationCenter.current()
            let pending = await center.pendingNotificationRequests()
            center.removePendingNotificationRequests(withIdentifiers: pending.map { $0.identifier }.filter { $0.hasPrefix(prefix) })

            var settings = await center.notificationSettings()
            if settings.authorizationStatus == .notDetermined && !items.isEmpty {
                _ = try? await center.requestAuthorization(options: [.alert, .sound])
                settings = await center.notificationSettings()
            }
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                call.resolve(["scheduled": 0, "status": Self.statusName(settings.authorizationStatus)])
                return
            }

            var count = 0
            for item in items.prefix(60) {
                guard let id = item["id"] as? String,
                      let habitId = item["habitId"] as? String,
                      let date = item["date"] as? String,
                      let at = item["at"] as? String,
                      let comps = Self.components(at) else { continue }
                let content = UNMutableNotificationContent()
                content.title = item["title"] as? String ?? "Habitude"
                content.body = item["body"] as? String ?? ""
                content.sound = .default
                content.categoryIdentifier = LifeNotifications.habitCategory
                content.threadIdentifier = "life.habits"
                content.userInfo = ["habitId": habitId, "date": date]
                let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                do {
                    try await center.add(UNNotificationRequest(identifier: prefix + id, content: content, trigger: trigger))
                    count += 1
                } catch {
                    print("Life – rappel impossible : \(error)")
                }
            }
            call.resolve(["scheduled": count, "status": Self.statusName(settings.authorizationStatus)])
        }
    }

    // « 2026-11-03T21:30 » → composantes de date locales
    private static func components(_ at: String) -> DateComponents? {
        let parts = at.split(separator: "T")
        guard parts.count == 2 else { return nil }
        let d = parts[0].split(separator: "-").compactMap { Int($0) }
        let t = parts[1].split(separator: ":").compactMap { Int($0) }
        guard d.count == 3, t.count >= 2 else { return nil }
        var c = DateComponents()
        c.year = d[0]; c.month = d[1]; c.day = d[2]; c.hour = t[0]; c.minute = t[1]
        return c
    }

    private static func statusName(_ s: UNAuthorizationStatus) -> String {
        switch s {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .provisional, .ephemeral: return "granted"
        case .notDetermined: return "prompt"
        @unknown default: return "prompt"
        }
    }
}
