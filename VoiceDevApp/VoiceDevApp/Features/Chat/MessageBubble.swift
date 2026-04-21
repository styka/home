import SwiftUI
import MarkdownUI

struct MessageBubble: View {
    let message: Message

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            if message.role == .user { Spacer(minLength: 48) }

            Group {
                if message.role == .assistant {
                    Markdown(message.content)
                        .markdownTheme(.gitHub)
                        .padding(12)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                } else {
                    Text(message.content)
                        .padding(12)
                        .background(Color.blue)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }

            if message.role == .assistant { Spacer(minLength: 48) }
        }
        .padding(.horizontal, 8)
    }
}
