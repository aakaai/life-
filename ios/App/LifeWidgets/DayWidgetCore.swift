import AppIntents
import SwiftUI
import WidgetKit

// Widget « Ma journée » (v0.23, demande du 4 nov.) : partie commune à l'extension et à l'app
// (l'app s'en sert seulement pour dessiner une capture de contrôle avec -widgetSnapshot).
// Données : résumé écrit par Life dans Supabase (table widget_feed), lu avec la clé privée
// via la fonction Edge « widget ». Pas d'App Group : le compte Apple gratuit ne le garantit pas.

// MARK: - Données

struct LifeFeed: Codable, Equatable {
    var v: Int
    var generatedAt: Double
    var today: String
    var events: [LifeEvent]
    var tasks: [LifeTask]
    var habits: [LifeHabit]
    var habitsDate: String
}

struct LifeEvent: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    var sub: String?
    var start: Double?
    var end: Double?
    var allDay: Bool
    var date: String
    var dayEnd: String?
    var color: String
    var kind: String

    var startDate: Date? { start.map { Date(timeIntervalSince1970: $0 / 1000) } }
    var endDate: Date? { end.map { Date(timeIntervalSince1970: $0 / 1000) } }
}

struct LifeTask: Codable, Equatable, Identifiable {
    var id: String
    var title: String
    var time: String?
    var priority: Int
    var done: Bool
    var late: Bool
    var due: String?
    var color: String?
}

struct LifeHabit: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var color: String
    var done: Bool
    var tickable: Bool
    var note: String?
}

// MARK: - Dates

enum LifeDay {
    static let fr = Locale(identifier: "fr_BE")
    static func key(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
    // La journée des habitudes finit à 3 h du matin (comme dans Life).
    static func habitKey(_ d: Date) -> String { key(d.addingTimeInterval(-3 * 3600)) }
    static func addDays(_ k: String, _ n: Int) -> String {
        let p = k.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, let d = Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)),
              let r = Calendar.current.date(byAdding: .day, value: n, to: d) else { return k }
        return key(r)
    }
    static func hm(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: d)
        return String(format: "%d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
    static func weekday(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = fr
        f.dateFormat = "EEEE"
        return f.string(from: d)
    }
    static func dayMonth(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = fr
        f.dateFormat = "d MMM"
        return f.string(from: d).replacingOccurrences(of: ".", with: "")
    }
}

// MARK: - Couleurs (palette Notion de Life, claire et sombre)

extension Color {
    init(light: UInt32, dark: UInt32) {
        func ui(_ v: UInt32) -> UIColor {
            UIColor(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
        }
        self = Color(UIColor { $0.userInterfaceStyle == .dark ? ui(dark) : ui(light) })
    }

    static func life(_ token: String?) -> Color {
        switch token ?? "gray" {
        case "brown": return Color(light: 0x9F6B53, dark: 0xBA856F)
        case "orange": return Color(light: 0xD9730D, dark: 0xC77D48)
        case "yellow": return Color(light: 0xCB912F, dark: 0xCA9849)
        case "green": return Color(light: 0x448361, dark: 0x529E72)
        case "blue": return Color(light: 0x337EA9, dark: 0x5E87C9)
        case "purple": return Color(light: 0x9065B0, dark: 0x9D68D3)
        case "pink": return Color(light: 0xC14C8A, dark: 0xD15796)
        case "red": return Color(light: 0xD44C47, dark: 0xDF5452)
        case "sand": return Color(light: 0xA8916A, dark: 0xC4AD86)
        case "coral": return Color(light: 0xE06A4F, dark: 0xEF8468)
        case "rose": return Color(light: 0xD9789F, dark: 0xE893B6)
        case "indigo": return Color(light: 0x5A5FCF, dark: 0x8589EC)
        case "navy": return Color(light: 0x34507F, dark: 0x4A68A6)
        case "teal": return Color(light: 0x1F8A83, dark: 0x3FB0A6)
        case "lime": return Color(light: 0x6B9A1E, dark: 0x94C44A)
        case "c-velo": return Color(light: 0x2383E2, dark: 0x3987E5)
        case "c-muscu": return Color(light: 0xD9730D, dark: 0xD95926)
        default: return Color(light: 0x787774, dark: 0x9B9B9B)
        }
    }
    static let lifeRed = Color(light: 0xE03E3E, dark: 0xFF6961)
}

// MARK: - Stockage local de l'extension (dernier résumé + clé)

enum LifeWidgetStore {
    private static let d = UserDefaults.standard
    static var key: String? {
        get { d.string(forKey: "life.widget.key") }
        set { d.set(newValue, forKey: "life.widget.key") }
    }
    static func cached() -> LifeFeed? {
        guard let data = d.data(forKey: "life.widget.feed") else { return nil }
        return try? LifeAPI.decoder.decode(LifeFeed.self, from: data)
    }
    static func save(_ feed: LifeFeed) {
        if let data = try? JSONEncoder().encode(feed) { d.set(data, forKey: "life.widget.feed") }
    }
    // Coche tout de suite dans le résumé gardé (le widget se redessine sans attendre le réseau).
    static func apply(kind: String, id: String, done: Bool) {
        guard var f = cached() else { return }
        if kind == "task", let i = f.tasks.firstIndex(where: { $0.id == id }) { f.tasks[i].done = done }
        if kind == "habit", let i = f.habits.firstIndex(where: { $0.id == id }) { f.habits[i].done = done }
        save(f)
    }
}

// MARK: - Fonction Edge « widget »

struct LifeWidgetError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

enum LifeAPI {
    static let url = URL(string: "https://ouqbtroaamnxvssufyey.supabase.co/functions/v1/widget")!
    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    private static func send(_ req: URLRequest) async throws -> LifeFeed {
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw LifeWidgetError(message: msg ?? "Erreur \(status)")
        }
        return try decoder.decode(LifeFeed.self, from: data)
    }

    static func fetch(key: String) async throws -> LifeFeed {
        var req = URLRequest(url: url, timeoutInterval: 12)
        req.setValue(key, forHTTPHeaderField: "x-life-key")
        return try await send(req)
    }

    static func toggle(key: String, kind: String, id: String, day: String, done: Bool) async throws -> LifeFeed {
        var req = URLRequest(url: url, timeoutInterval: 12)
        req.httpMethod = "POST"
        req.setValue(key, forHTTPHeaderField: "x-life-key")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["kind": kind, "id": id, "date": day, "done": done])
        return try await send(req)
    }
}

// MARK: - Intents (réglage du widget et case à cocher)

struct DayWidgetConfig: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Ma journée" }
    static var description: IntentDescription { IntentDescription("Colle la clé créée dans Life › Réglages › Widget iPhone.") }

    @Parameter(title: "Clé")
    var key: String?

    init() {}
}

struct ToggleItemIntent: AppIntent {
    static var title: LocalizedStringResource { "Cocher" }
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Type") var kind: String
    @Parameter(title: "Élément") var itemId: String
    @Parameter(title: "Jour") var day: String
    @Parameter(title: "Fait") var done: Bool

    init() {}
    init(kind: String, itemId: String, day: String, done: Bool) {
        self.kind = kind
        self.itemId = itemId
        self.day = day
        self.done = done
    }

    func perform() async throws -> some IntentResult {
        LifeWidgetStore.apply(kind: kind, id: itemId, done: done)
        if let key = LifeWidgetStore.key, let feed = try? await LifeAPI.toggle(key: key, kind: kind, id: itemId, day: day, done: done) {
            LifeWidgetStore.save(feed)
        }
        return .result()
    }
}

// MARK: - Entrée de la frise

enum DayState: Equatable { case ok, noKey, error(String) }

struct DayEntry: TimelineEntry {
    let date: Date
    let feed: LifeFeed?
    let state: DayState
}

// MARK: - Vues

struct DayWidgetView: View {
    let entry: DayEntry

    var body: some View {
        if entry.state == .noKey {
            NoKeyView()
        } else if let feed = entry.feed {
            HStack(spacing: 0) {
                CalendarColumn(feed: feed, now: entry.date)
                    .padding(EdgeInsets(top: 13, leading: 14, bottom: 11, trailing: 10))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                Rectangle().fill(Color(.separator)).frame(width: 0.5)
                VStack(spacing: 0) {
                    TasksBox(feed: feed, now: entry.date)
                        .padding(EdgeInsets(top: 12, leading: 12, bottom: 8, trailing: 12))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    Rectangle().fill(Color(.separator)).frame(height: 0.5)
                    HabitsBox(feed: feed, now: entry.date)
                        .padding(EdgeInsets(top: 11, leading: 12, bottom: 8, trailing: 12))
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
                .frame(maxWidth: .infinity)
            }
            .overlay(alignment: .bottomTrailing) {
                if case .error = entry.state {
                    Image(systemName: "wifi.slash").font(.system(size: 9)).foregroundStyle(.tertiary).padding(6)
                }
            }
        } else {
            VStack(spacing: 6) {
                Image(systemName: "wifi.slash").font(.title3).foregroundStyle(.secondary)
                Text(errorText).font(.footnote).multilineTextAlignment(.center).foregroundStyle(.secondary)
            }
            .padding()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var errorText: String {
        if case let .error(m) = entry.state { return m }
        return "Chargement…"
    }
}

struct NoKeyView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ma journée").font(.headline)
            Text("1. Dans Life › Réglages › Widget iPhone, crée ta clé et copie-la.")
            Text("2. Ici : appui long › Modifier le widget › colle-la dans « Clé ».")
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
        .padding(18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct SectionHeader: View {
    let title: String
    let color: Color
    let count: String
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title.uppercased()).font(.system(size: 12, weight: .bold)).foregroundStyle(color)
            Spacer(minLength: 4)
            Text(count).font(.system(size: 11, weight: .semibold)).foregroundStyle(.secondary).monospacedDigit()
        }
    }
}

struct CheckMark: View {
    let done: Bool
    let color: Color
    var enabled = true
    var body: some View {
        ZStack {
            Circle().fill(done ? color : Color.clear)
            Circle().strokeBorder(done ? color : Color.secondary.opacity(enabled ? 0.55 : 0.25), lineWidth: 1.5)
            if done {
                Image(systemName: "checkmark").font(.system(size: 8.5, weight: .heavy)).foregroundStyle(.white)
            }
        }
        .frame(width: 17, height: 17)
    }
}

// Calendrier : à partir de maintenant, puis demain.
struct CalendarColumn: View {
    let feed: LifeFeed
    let now: Date

    var body: some View {
        let today = LifeDay.key(now)
        let tomorrow = LifeDay.addDays(today, 1)
        let allDay = feed.events.filter { $0.allDay && $0.date <= today && ($0.dayEnd ?? LifeDay.addDays($0.date, 1)) > today }
        let timed = feed.events.filter { !$0.allDay && ($0.endDate ?? .distantPast) > now }
        let left = timed.filter { LifeDay.key($0.startDate ?? now) <= today }
        let next = timed.filter { LifeDay.key($0.startDate ?? now) == tomorrow }
        let room = max(2, 5 - min(allDay.count, 2))
        let shown = Array(left.prefix(room))
        let more = left.count - shown.count

        VStack(alignment: .leading, spacing: 5) {
            Text(LifeDay.weekday(now).uppercased()).font(.system(size: 12, weight: .bold)).foregroundStyle(Color.lifeRed)
            Text(LifeDay.dayMonth(now)).font(.system(size: 22, weight: .bold)).padding(.top, -4)
            ForEach(allDay.prefix(2)) { e in
                HStack(spacing: 5) {
                    Circle().fill(Color.life(e.color)).frame(width: 6, height: 6)
                    Text(e.title).font(.system(size: 11, weight: .semibold)).lineLimit(1)
                }
            }
            HStack(spacing: 4) {
                Text("Maintenant").font(.system(size: 10, weight: .bold)).foregroundStyle(Color.lifeRed)
                Capsule().fill(Color.lifeRed).frame(height: 1.5)
            }
            .padding(.vertical, 1)
            if shown.isEmpty {
                Text("Rien d'autre aujourd'hui").font(.system(size: 12)).foregroundStyle(.secondary)
                if !next.isEmpty {
                    Text("DEMAIN").font(.system(size: 10, weight: .bold)).foregroundStyle(.tertiary).padding(.top, 2)
                    ForEach(next.prefix(3)) { e in EventRow(e: e, now: now) }
                }
            } else {
                ForEach(shown) { e in EventRow(e: e, now: now) }
            }
            Spacer(minLength: 0)
            if more > 0 || (!shown.isEmpty && !next.isEmpty) {
                Text(footer(more: more, next: next.first))
                    .font(.system(size: 10.5)).foregroundStyle(.secondary).lineLimit(2)
            }
        }
    }

    private func footer(more: Int, next: LifeEvent?) -> String {
        var parts: [String] = []
        if more > 0 { parts.append("+ \(more) plus tard") }
        if let n = next, let s = n.startDate { parts.append("demain \(LifeDay.hm(s)) \(n.title)") }
        return parts.joined(separator: " · ")
    }
}

struct EventRow: View {
    let e: LifeEvent
    let now: Date
    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            RoundedRectangle(cornerRadius: 1.5).fill(Color.life(e.color)).frame(width: 3.5)
            VStack(alignment: .leading, spacing: 0) {
                Text(timeText).font(.system(size: 10.5)).foregroundStyle(.secondary).lineLimit(1)
                Text(e.title).font(.system(size: 12.5, weight: .semibold)).lineLimit(1)
                if let s = e.sub, !s.isEmpty {
                    Text(s).font(.system(size: 10.5)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
    private var timeText: String {
        guard let s = e.startDate, let en = e.endDate else { return "" }
        if s <= now { return "En cours · jusqu'à \(LifeDay.hm(en))" }
        if e.kind == "meal" { return LifeDay.hm(s) }
        return "\(LifeDay.hm(s)) – \(LifeDay.hm(en))"
    }
}

struct TasksBox: View {
    let feed: LifeFeed
    let now: Date
    var body: some View {
        let fresh = feed.today == LifeDay.key(now)
        let tasks = feed.tasks.sorted(by: order)
        let done = feed.tasks.filter(\.done).count
        VStack(alignment: .leading, spacing: 3) {
            SectionHeader(title: "Tâches", color: .primary, count: "\(done)/\(feed.tasks.count)")
                .padding(.bottom, 2)
            if !fresh {
                StaleText()
            } else if tasks.isEmpty {
                Text("Rien à faire aujourd'hui").font(.system(size: 12)).foregroundStyle(.secondary)
            } else {
                ForEach(tasks.prefix(4)) { t in
                    HStack(spacing: 7) {
                        Button(intent: ToggleItemIntent(kind: "task", itemId: t.id, day: feed.today, done: !t.done)) {
                            CheckMark(done: t.done, color: Color(light: 0x37352F, dark: 0x8E8E93))
                        }
                        .buttonStyle(.plain)
                        Text(t.title)
                            .font(.system(size: 12.5))
                            .strikethrough(t.done)
                            .foregroundStyle(t.done ? Color.secondary.opacity(0.7) : Color.primary)
                            .lineLimit(1)
                        if t.priority >= 3 && !t.done {
                            Circle().fill(Color.lifeRed).frame(width: 5, height: 5)
                        }
                        Spacer(minLength: 2)
                        if t.late && !t.done {
                            Text("retard").font(.system(size: 10, weight: .semibold)).foregroundStyle(Color.lifeRed)
                        } else if let time = t.time, !t.done {
                            Text(time).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                        }
                    }
                    .frame(height: 22)
                }
                if tasks.count > 4 {
                    Text("+ \(tasks.count - 4) autres").font(.system(size: 10.5)).foregroundStyle(.secondary)
                }
            }
        }
    }
    private func order(_ a: LifeTask, _ b: LifeTask) -> Bool {
        if a.done != b.done { return !a.done }
        if a.late != b.late { return a.late }
        if (a.time != nil) != (b.time != nil) { return a.time != nil }
        if let x = a.time, let y = b.time, x != y { return x < y }
        return a.priority > b.priority
    }
}

struct HabitsBox: View {
    let feed: LifeFeed
    let now: Date
    var body: some View {
        let fresh = feed.habitsDate == LifeDay.habitKey(now)
        let habits = feed.habits.sorted { a, b in a.done == b.done ? false : !a.done }
        let done = feed.habits.filter(\.done).count
        let pink = Color.life("pink")
        VStack(alignment: .leading, spacing: 3) {
            SectionHeader(title: "Habitudes", color: pink, count: "\(done)/\(feed.habits.count)")
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.secondary.opacity(0.18))
                    Capsule().fill(pink).frame(width: feed.habits.isEmpty ? 0 : g.size.width * CGFloat(done) / CGFloat(feed.habits.count))
                }
            }
            .frame(height: 4)
            .padding(.bottom, 2)
            if !fresh {
                StaleText()
            } else if habits.isEmpty {
                Text("Pas d'habitude aujourd'hui").font(.system(size: 12)).foregroundStyle(.secondary)
            } else {
                ForEach(habits.prefix(4)) { h in
                    HStack(spacing: 7) {
                        if h.tickable {
                            Button(intent: ToggleItemIntent(kind: "habit", itemId: h.id, day: feed.habitsDate, done: !h.done)) {
                                CheckMark(done: h.done, color: Color.life(h.color))
                            }
                            .buttonStyle(.plain)
                        } else {
                            CheckMark(done: h.done, color: Color.life(h.color), enabled: false)
                        }
                        Text(h.name)
                            .font(.system(size: 12.5))
                            .strikethrough(h.done)
                            .foregroundStyle(h.done ? Color.secondary.opacity(0.7) : Color.primary)
                            .lineLimit(1)
                        Spacer(minLength: 2)
                        if let n = h.note, !n.isEmpty {
                            Text(n).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                    .frame(height: 22)
                }
                if habits.count > 4 {
                    Text("+ \(habits.count - 4) autres").font(.system(size: 10.5)).foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct StaleText: View {
    var body: some View {
        Text("Ouvre Life pour mettre à jour").font(.system(size: 11.5)).foregroundStyle(.secondary)
    }
}

// MARK: - Exemple (aperçu dans la galerie des widgets et capture de contrôle)

extension LifeFeed {
    static func sample(now: Date = Date()) -> LifeFeed {
        let today = LifeDay.key(now)
        func ev(_ id: String, _ title: String, _ sub: String, _ inMin: Double, _ dur: Double, _ color: String, _ kind: String = "google") -> LifeEvent {
            let s = now.addingTimeInterval(inMin * 60)
            return LifeEvent(id: id, title: title, sub: sub, start: s.timeIntervalSince1970 * 1000, end: s.addingTimeInterval(dur * 60).timeIntervalSince1970 * 1000,
                             allDay: false, date: LifeDay.key(s), dayEnd: nil, color: color, kind: kind)
        }
        return LifeFeed(
            v: 1, generatedAt: now.timeIntervalSince1970 * 1000, today: today,
            events: [
                ev("1", "Évaluation des actifs fin.", "B104", -20, 120, "purple", "cours"),
                ev("2", "Midi · Bowl shawarma", "640 kcal", 150, 30, "green", "meal"),
                ev("3", "IA 1", "A201", 225, 120, "purple", "cours"),
                ev("4", "Sweet spot 2×15", "", 450, 60, "c-velo", "sport"),
                ev("5", "Haut A — poussée", "", 525, 50, "c-muscu", "sport"),
                ev("6", "Soirée Max", "Chez Max", 630, 120, "pink"),
                ev("7", "Électronique", "B201", 24 * 60, 120, "purple", "cours")
            ],
            tasks: [
                LifeTask(id: "t1", title: "Rendre rapport IA", time: nil, priority: 3, done: false, late: true, due: nil, color: "purple"),
                LifeTask(id: "t2", title: "Mail prof Ejzyn", time: "11:00", priority: 2, done: false, late: false, due: nil, color: "purple"),
                LifeTask(id: "t3", title: "Réserver vols Bangkok", time: nil, priority: 2, done: false, late: false, due: nil, color: "gray"),
                LifeTask(id: "t4", title: "Courses Colruyt", time: nil, priority: 1, done: true, late: false, due: nil, color: "gray")
            ],
            habits: [
                LifeHabit(id: "h1", name: "Lire 20 min", color: "purple", done: false, tickable: true, note: "21:00"),
                LifeHabit(id: "h2", name: "2 L d'eau", color: "blue", done: true, tickable: true, note: "2/2 L"),
                LifeHabit(id: "h3", name: "Étirements", color: "green", done: false, tickable: true, note: ""),
                LifeHabit(id: "h4", name: "Protéines", color: "green", done: true, tickable: false, note: "auto")
            ],
            habitsDate: LifeDay.habitKey(now)
        )
    }
}
