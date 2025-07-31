export default function ChatBubble({ text, alignment }) {
    const styles = {
        bubble: {
            maxWidth: '80%',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            marginBottom: '10px',
            fontFamily: 'Arial, sans-serif',
        },
        right: {
            backgroundColor: '#2563eb',
            color: 'white',
            alignSelf: 'flex-end',
            borderTopRightRadius: '0',
        },
        left: {
            backgroundColor: '#f0f6ff',
            color: '#1e293b',
            alignSelf: 'flex-start',
            borderTopLeftRadius: '0',
        },
    };

    const alignmentStyle = alignment === 'right' ? styles.right : styles.left;

    return <div style={{ ...styles.bubble, ...alignmentStyle }}>{text}</div>;
}

