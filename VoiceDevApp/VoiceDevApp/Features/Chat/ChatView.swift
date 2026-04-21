import SwiftUI

struct ChatView: View {
    @StateObject private var vm = ChatViewModel()
    @State private var showSettings = false
    @State private var inputText = ""
    @State private var hasPermissions = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                messageList
                Divider()
                inputBar
            }
            .navigationTitle("Voice Dev")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { vm.clearHistory() } label: {
                        Image(systemName: "trash")
                    }
                    .disabled(vm.messages.isEmpty)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showSettings = true } label: {
                        Image(systemName: "gear")
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
        }
        .task {
            hasPermissions = await vm.speechRecognizer.requestPermissions()
        }
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(vm.messages.filter { $0.role != .system }) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                    if vm.isLoading {
                        HStack {
                            ProgressView()
                                .padding(12)
                                .background(Color(.secondarySystemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            Spacer()
                        }
                        .padding(.horizontal, 8)
                        .id("loading")
                    }
                    if let err = vm.errorMessage {
                        Text(err)
                            .foregroundStyle(.red)
                            .font(.caption)
                            .padding(.horizontal, 16)
                            .id("error")
                    }
                }
                .padding(.vertical, 8)
            }
            .onChange(of: vm.messages.count) {
                withAnimation { proxy.scrollTo(vm.messages.last?.id, anchor: .bottom) }
            }
            .onChange(of: vm.isLoading) {
                if vm.isLoading { withAnimation { proxy.scrollTo("loading", anchor: .bottom) } }
            }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 12) {
            TextField("Napisz pytanie...", text: $inputText, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(1...4)
                .onSubmit { sendText() }

            if vm.speechRecognizer.isListening {
                Button { vm.sendCurrentTranscript() } label: {
                    Image(systemName: "stop.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.red)
                }
            } else {
                Button { vm.speechRecognizer.startListening() } label: {
                    Image(systemName: "mic.circle.fill")
                        .font(.title2)
                        .foregroundStyle(hasPermissions ? Color.blue : Color.gray)
                }
                .disabled(!hasPermissions || vm.isLoading)
            }

            if !inputText.isEmpty {
                Button { sendText() } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(Color.blue)
                }
                .disabled(vm.isLoading)
            }
        }
        .padding(12)
        .overlay(alignment: .top) {
            if vm.speechRecognizer.isListening {
                Text(vm.speechRecognizer.transcript.isEmpty ? "Słucham..." : vm.speechRecognizer.transcript)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
                    .offset(y: -18)
            }
        }
    }

    private func sendText() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !vm.isLoading else { return }
        inputText = ""
        vm.send(text: text)
    }
}
