import UIKit
import Capacitor

// Vue principale de l'app : la page web de Life + nos fonctions natives.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RestActivityPlugin())
        bridge?.registerPluginInstance(HabitRemindersPlugin())
    }
}
