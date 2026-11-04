import SwiftUI
import UIKit

// Capture de contrôle du widget « Ma journée » (compilation GitHub) : lancée seulement avec
// l'argument -widgetSnapshot, elle dessine le widget avec des données d'exemple, en clair et en sombre,
// dans Documents/widget-light.png et widget-dark.png. Sans cet argument, rien ne se passe.
enum WidgetSnapshot {
    static func runIfAsked() {
        guard ProcessInfo.processInfo.arguments.contains("-widgetSnapshot") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { render() }
    }

    @MainActor
    static func render() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let now = Calendar.current.date(bySettingHour: 9, minute: 40, second: 0, of: Date()) ?? Date()
        let states: [(String, DayEntry)] = [
            ("widget", DayEntry(date: now, feed: .sample(now: now), state: .ok)),
            ("widget-soir", DayEntry(date: now.addingTimeInterval(13 * 3600), feed: .sample(now: now), state: .ok)),
            ("widget-sans-cle", DayEntry(date: now, feed: nil, state: .noKey))
        ]
        for (name, entry) in states {
            for (suffix, scheme) in [("light", ColorScheme.light), ("dark", ColorScheme.dark)] {
                let view = DayWidgetView(entry: entry)
                    .frame(width: 338, height: 354)
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .padding(20)
                    .background(Color(.systemGray5))
                    .environment(\.colorScheme, scheme)
                let r = ImageRenderer(content: view)
                r.scale = 3
                if let data = r.uiImage?.pngData() {
                    try? data.write(to: docs.appendingPathComponent("\(name)-\(suffix).png"))
                }
            }
        }
        try? "ok".write(to: docs.appendingPathComponent("widget-done.txt"), atomically: true, encoding: .utf8)
    }
}
