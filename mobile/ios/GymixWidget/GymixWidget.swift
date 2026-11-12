import WidgetKit
import SwiftUI

// The Gymix home-screen widget for iPhone: how busy the gym is right now, days
// left on the membership, today's workout and visits this month.
// Data: /api/widget with the token the app saved in the shared App Group
// (GymixWidgetPlugin in SceneDelegate.swift). Refreshes about every 30 minutes
// and whenever the app opens.
//
// Setup (once, in Xcode; see mobile/README.md):
//   File > New > Target > Widget Extension, name "GymixWidget", no Live
//   Activity, no configuration intent. Replace the generated Swift file with
//   this one. Add the App Group "group.com.gymix.app" to both the App and the
//   GymixWidget targets (Signing & Capabilities).

struct GymixData: Decodable {
    let member: Bool?
    let gym: String?
    let inside: Int?
    let level: String?
    let days_left: Int?
    let today: String?
    let visits_month: Int?
}

struct GymixEntry: TimelineEntry {
    let date: Date
    let data: GymixData?
}

struct Provider: TimelineProvider {
    private let defaults = UserDefaults(suiteName: "group.com.gymix.app")

    func placeholder(in context: Context) -> GymixEntry {
        GymixEntry(date: .now, data: GymixData(member: true, gym: "Your gym", inside: 23, level: "moderate", days_left: 12, today: "Push day", visits_month: 9))
    }

    func getSnapshot(in context: Context, completion: @escaping (GymixEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GymixEntry>) -> Void) {
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
        guard let url = defaults?.string(forKey: "url").flatMap(URL.init(string:)), let token = defaults?.string(forKey: "token") else {
            completion(Timeline(entries: [GymixEntry(date: .now, data: nil)], policy: .after(next)))
            return
        }
        var request = URLRequest(url: url, timeoutInterval: 8)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        URLSession.shared.dataTask(with: request) { body, response, _ in
            var data: GymixData? = nil
            if let body, (response as? HTTPURLResponse)?.statusCode == 200 {
                data = try? JSONDecoder().decode(GymixData.self, from: body)
                defaults?.set(body, forKey: "last")
            } else if let last = defaults?.data(forKey: "last") {
                // Offline: show the last numbers.
                data = try? JSONDecoder().decode(GymixData.self, from: last)
            }
            completion(Timeline(entries: [GymixEntry(date: .now, data: data)], policy: .after(next)))
        }.resume()
    }
}

private let lime = Color(red: 200 / 255, green: 241 / 255, blue: 53 / 255)

struct GymixWidgetView: View {
    var entry: GymixEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        let d = entry.data
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 6).fill(lime).frame(width: 18, height: 18)
                Text(d?.gym ?? "Gymix").font(.system(size: 13, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                Spacer()
                Text("● LIVE").font(.system(size: 9, weight: .heavy)).foregroundStyle(lime)
            }
            if d?.member == true {
                Text("\(d?.inside ?? 0)")
                    .font(.system(size: 40, weight: .black, design: .rounded))
                    .foregroundStyle(lime)
                    .contentTransition(.numericText())
                Text(levelText(d?.level)).font(.system(size: 11)).foregroundStyle(.white.opacity(0.6))
                if family != .systemSmall {
                    HStack {
                        stat("DAYS LEFT", d?.days_left.map(String.init) ?? "–")
                        stat("VISITS", "\(d?.visits_month ?? 0)")
                        stat("TODAY", d?.today ?? "Rest day")
                    }
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.08)))
                    .padding(.top, 6)
                }
            } else {
                Spacer()
                Text("Open Gymix to connect").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.7))
            }
            Spacer(minLength: 0)
        }
        .containerBackground(for: .widget) {
            LinearGradient(
                colors: [Color(red: 0.04, green: 0.06, blue: 0.08), Color(red: 0.1, green: 0.14, blue: 0.06)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 8, weight: .bold)).foregroundStyle(.white.opacity(0.45))
            Text(value).font(.system(size: 14, weight: .bold)).foregroundStyle(.white).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func levelText(_ level: String?) -> String {
        switch level {
        case "quiet": return "inside · quiet now"
        case "moderate": return "inside · getting busy"
        case "busy": return "inside · busy now"
        case "full": return "inside · full"
        default: return "inside now"
        }
    }
}

@main
struct GymixWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "GymixWidget", provider: Provider()) { entry in
            GymixWidgetView(entry: entry)
        }
        .configurationDisplayName("Gymix")
        .description("How busy your gym is, days left and today's workout.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
