import WidgetKit
import SwiftUI

// Extension « widgets » de Life : pour l'instant, le chrono de repos (île dynamique + écran verrouillé).
@main
struct LifeWidgetsBundle: WidgetBundle {
    var body: some Widget {
        RestLiveActivity()
    }
}
