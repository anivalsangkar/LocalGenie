import { Link } from 'react-router-dom';
import cancel from "../icons/cancel.png"

export default function Sidebar({ onClose }) {
    const styles = {
        sidebar: {
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            width: '193px',
            backgroundColor: '#ffffff',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            fontFamily: 'Arial, sans-serif',
            boxShadow: '2px 0 5px rgba(0,0,0,0.05)',
            zIndex: 1000,
        },
        closeIcon: {
            width: '16px',
            height: '16px',
            cursor: 'pointer',
            marginBottom: '8px',
        },
        link: {
            textDecoration: 'none',
            color: '#111827',
            fontSize: '14px',
        },
    };

    const links = [
        { label: 'Home', path: '/home' },
        { label: 'Searches', path: '/services' },
        { label: 'Bookmarks', path: '/saved' },
        { label: 'Profile', path: '/profile' },
    ];

    return (
        <div style={styles.sidebar}>
            <img
                src={cancel}
                alt="Close"
                style={styles.closeIcon}
                onClick={onClose}
            />
            {links.map(({ label, path }) => (
                <Link key={path} to={path} style={styles.link} onClick={onClose}>
                    {label}
                </Link>
            ))}
        </div>
    );
}
