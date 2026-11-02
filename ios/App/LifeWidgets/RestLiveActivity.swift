import ActivityKit
import WidgetKit
import SwiftUI

// Orange « muscu » de l'app (#d9730d)
private let muscu = Color(red: 0.851, green: 0.451, blue: 0.051)

struct RestLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            RestLockScreenView(context: context)
        } dynamicIsland: { context in
            let range = context.state.startedAt...context.state.endsAt
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text("Repos")
                    } icon: {
                        Image(systemName: "dumbbell.fill").foregroundStyle(muscu)
                    }
                    .font(.headline)
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: range, countsDown: true)
                        .font(.title2.weight(.semibold).monospacedDigit())
                        .multilineTextAlignment(.trailing)
                        .frame(width: 84, alignment: .trailing)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        ProgressView(timerInterval: range, countsDown: true) {
                            EmptyView()
                        } currentValueLabel: {
                            EmptyView()
                        }
                        .tint(muscu)
                        Text("Ensuite : \(context.state.next)")
                            .font(.subheadline)
                            .lineLimit(1)
                        if !context.state.detail.isEmpty {
                            Text(context.state.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill").foregroundStyle(muscu)
            } compactTrailing: {
                Text(timerInterval: range, countsDown: true)
                    .monospacedDigit()
                    .multilineTextAlignment(.center)
                    .frame(width: 42)
                    .foregroundStyle(muscu)
            } minimal: {
                Image(systemName: "dumbbell.fill").foregroundStyle(muscu)
            }
            .keylineTint(muscu)
        }
    }
}

struct RestLockScreenView: View {
    let context: ActivityViewContext<RestActivityAttributes>

    var body: some View {
        let range = context.state.startedAt...context.state.endsAt
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(muscu.opacity(0.18))
                    Image(systemName: "dumbbell.fill").foregroundStyle(muscu)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Repos · \(context.attributes.title)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Text("Ensuite : \(context.state.next)")
                        .font(.headline)
                        .lineLimit(1)
                    if !context.state.detail.isEmpty {
                        Text(context.state.detail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                Text(timerInterval: range, countsDown: true)
                    .font(.system(size: 34, weight: .semibold).monospacedDigit())
                    .multilineTextAlignment(.trailing)
                    .frame(width: 100, alignment: .trailing)
            }
            ProgressView(timerInterval: range, countsDown: true) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .tint(muscu)
        }
        .padding(16)
    }
}
