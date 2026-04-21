import Foundation
import AVFoundation

@MainActor
final class SpeechSynthesizer: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    @Published var isSpeaking = false

    private let synthesizer = AVSpeechSynthesizer()

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(_ markdownText: String) {
        let plain = stripMarkdown(markdownText)
        guard !plain.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {}

        let utterance = AVSpeechUtterance(string: plain)
        utterance.voice = AVSpeechSynthesisVoice(language: "pl-PL")
        utterance.rate = 0.52
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = true }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = false }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = false }
    }

    private func stripMarkdown(_ text: String) -> String {
        var s = text
        // Remove fenced code blocks entirely, replace with short note
        s = s.replacingOccurrences(of: "```[\\s\\S]*?```", with: "blok kodu,", options: .regularExpression)
        // Remove inline code
        s = s.replacingOccurrences(of: "`[^`]+`", with: "", options: .regularExpression)
        // Remove ATX headers markers
        s = s.replacingOccurrences(of: "^#{1,6}\\s+", with: "", options: [.regularExpression, .anchorsMatchLines])
        // Remove bold/italic markers, keep inner text
        s = s.replacingOccurrences(of: "\\*{1,3}([^*\\n]+)\\*{1,3}", with: "$1", options: .regularExpression)
        s = s.replacingOccurrences(of: "_{1,3}([^_\\n]+)_{1,3}", with: "$1", options: .regularExpression)
        // Inline links → just the label
        s = s.replacingOccurrences(of: "\\[([^\\]]+)\\]\\([^)]+\\)", with: "$1", options: .regularExpression)
        // List markers
        s = s.replacingOccurrences(of: "^[\\-\\*\\+]\\s+", with: "", options: [.regularExpression, .anchorsMatchLines])
        s = s.replacingOccurrences(of: "^\\d+\\.\\s+", with: "", options: [.regularExpression, .anchorsMatchLines])
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
