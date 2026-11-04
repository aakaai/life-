import AppIntents
import SwiftUI
import WidgetKit

// Grand widget « Ma journée » (4×4) : calendrier vertical à gauche (à partir de maintenant),
// Tâches et Habitudes à droite, cochables sans ouvrir Life. iOS redemande les données à peu près
// toutes les 30 minutes ; la frise avance toute seule par quarts d'heure entre deux mises à jour.
struct DayProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> DayEntry {
        DayEntry(date: Date(), feed: .sample(), state: .ok)
    }

    func snapshot(for configuration: DayWidgetConfig, in context: Context) async -> DayEntry {
        if context.isPreview { return DayEntry(date: Date(), feed: .sample(), state: .ok) }
        return await load(configuration).first ?? placeholder(in: context)
    }

    func timeline(for configuration: DayWidgetConfig, in context: Context) async -> Timeline<DayEntry> {
        let entries = await load(configuration)
        let next = Date().addingTimeInterval(entries.first?.state == .noKey ? 3600 : 30 * 60)
        return Timeline(entries: entries, policy: .after(next))
    }

    private func load(_ configuration: DayWidgetConfig) async -> [DayEntry] {
        let typed = configuration.key?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !typed.isEmpty { LifeWidgetStore.key = typed }
        let now = Date()
        guard let key = LifeWidgetStore.key, !key.isEmpty else {
            return [DayEntry(date: now, feed: nil, state: .noKey)]
        }
        var feed = LifeWidgetStore.cached()
        var state = DayState.ok
        do {
            let fresh = try await LifeAPI.fetch(key: key)
            LifeWidgetStore.save(fresh)
            feed = fresh
        } catch {
            state = .error(error.localizedDescription)
        }
        // une entrée par quart d'heure sur 3 h : « maintenant » avance et les évènements finis disparaissent
        let start = Date(timeIntervalSince1970: (now.timeIntervalSince1970 / 60).rounded(.down) * 60)
        return (0..<12).map { i in
            DayEntry(date: start.addingTimeInterval(Double(i) * 15 * 60), feed: feed, state: state)
        }
    }
}

struct DayWidget: Widget {
    let kind = "LifeDayWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: DayWidgetConfig.self, provider: DayProvider()) { entry in
            DayWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color(.systemBackground) }
        }
        .configurationDisplayName("Ma journée")
        .description("Calendrier du jour, tâches et habitudes. Coche sans ouvrir Life.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}
