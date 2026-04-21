import SwiftUI
import AVFoundation

struct SettingsView: View {
    @StateObject private var vm = SettingsViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Groq API") {
                    SecureField("Klucz API (gsk_...)", text: $vm.apiKey)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Text("Darmowe konto: console.groq.com")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Synteza mowy") {
                    Toggle("Czytaj odpowiedzi głosowo", isOn: $vm.ttsEnabled)
                    if vm.polishVoices.isEmpty {
                        Text("Brak polskiego głosu. Zainstaluj w: Ustawienia → Dostępność → Mówiona zawartość → Głosy → Polski.")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    } else {
                        Text("Głosy: \(vm.polishVoices.map(\.name).joined(separator: ", "))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("O aplikacji") {
                    LabeledContent("Model LLM", value: AppConfig.groqModel)
                    LabeledContent("STT", value: "Apple SFSpeechRecognizer (pl-PL)")
                    LabeledContent("TTS", value: "Apple AVSpeechSynthesizer (pl-PL)")
                }
            }
            .navigationTitle("Ustawienia")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Gotowe") { dismiss() }
                }
            }
        }
    }
}
