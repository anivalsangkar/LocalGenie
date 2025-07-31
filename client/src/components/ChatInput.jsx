import send from "../icons/send.png"

export default function ChatInput({ placeholder }) {
    const styles = {
        container: {
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
            fontFamily: 'Arial, sans-serif',
        },
        input: {
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            padding: '8px',
            fontFamily: 'inherit',
        },
        icon: {
            width: '20px',
            height: '20px',
            marginLeft: '10px',
            cursor: 'pointer',
        },
    };

    return (
        <div style={styles.container}>
            <input type="text" placeholder={placeholder} style={styles.input} />
            <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <img src={send} alt="Send" style={styles.icon} />
            </button>
        </div>
    );
}
