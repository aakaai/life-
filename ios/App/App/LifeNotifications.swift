import Foundation
import UserNotifications

// Reçoit les notifications de Life dès le lancement de l'app (même app fermée) :
//   - rappels d'habitudes : bannière, bouton « Fait » ;
//   - fin de repos muscu : rien au premier plan (l'app bipe déjà).
// Les actions (« Fait », toucher la notification) sont gardées dans UserDefaults
// jusqu'à ce que la page web les récupère (HabitRemindersPlugin.takePending).
final class LifeNotifications: NSObject, UNUserNotificationCenterDelegate {
    static let shared = LifeNotifications()
    static let habitCategory = "LIFE_HABIT"
    static let doneAction = "HABIT_DONE"
    static let pendingKey = "life.pendingHabitActions"
    static let actionReceived = Notification.Name("LifeHabitActionReceived")

    func install() {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        let done = UNNotificationAction(identifier: Self.doneAction, title: "Fait ✓", options: [.foreground])
        let category = UNNotificationCategory(identifier: Self.habitCategory, actions: [done], intentIdentifiers: [], options: [])
        center.setNotificationCategories([category])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        if notification.request.content.categoryIdentifier == Self.habitCategory {
            completionHandler([.banner, .list, .sound])
        } else {
            completionHandler([])
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        if let habitId = info["habitId"] as? String, let date = info["date"] as? String {
            var action: String? = nil
            if response.actionIdentifier == Self.doneAction {
                action = "done"
            } else if response.actionIdentifier == UNNotificationDefaultActionIdentifier {
                action = "open"
            }
            if let action = action {
                var list = UserDefaults.standard.array(forKey: Self.pendingKey) as? [[String: String]] ?? []
                list.append(["habitId": habitId, "date": date, "action": action])
                UserDefaults.standard.set(list, forKey: Self.pendingKey)
                NotificationCenter.default.post(name: Self.actionReceived, object: nil)
            }
        }
        completionHandler()
    }

    static func takePending() -> [[String: String]] {
        let list = UserDefaults.standard.array(forKey: pendingKey) as? [[String: String]] ?? []
        UserDefaults.standard.removeObject(forKey: pendingKey)
        return list
    }
}
