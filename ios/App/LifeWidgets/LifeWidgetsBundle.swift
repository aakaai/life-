import WidgetKit
import SwiftUI

// Extension « widgets » de Life : le chrono de repos (île dynamique + écran verrouillé)
// et le grand widget « Ma journée » (v0.23).
@main
struct LifeWidgetsBundle: WidgetBundle {
    var body: some Widget {
        RestLiveActivity()
        DayWidget()
    }
}
