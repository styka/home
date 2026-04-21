import Foundation
import AVFoundation

@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var apiKey: String {
        didSet { AppConfig.groqAPIKey = apiKey }
    }
    @Published var ttsEnabled: Bool {
        didSet { AppConfig.ttsEnabled = ttsEnabled }
    }
    @Published var polishVoices: [AVSpeechSynthesisVoice] = []

    init() {
        apiKey = AppConfig.groqAPIKey
        ttsEnabled = AppConfig.ttsEnabled
        polishVoices = AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("pl") }
    }
}
