import ActivityKit
import Foundation

// Données du chrono de repos, partagées entre l'app et l'extension (île dynamique).
struct RestActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startedAt: Date
        var endsAt: Date
        var next: String
        var detail: String
    }

    // Nom de la séance (ex. « Haut A — poussée »)
    var title: String
}
