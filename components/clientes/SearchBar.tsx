'use client';

export default function SearchBar() {
    return (
        <div className="relative">
            <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                    background: 'rgba(116, 116, 128, 0.12)',
                    border: '1px solid transparent',
                }}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="6.5" cy="6.5" r="5" stroke="#8E8E93" strokeWidth="1.6" />
                    <path d="M10.5 10.5L14 14" stroke="#8E8E93" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <input
                    type="text"
                    placeholder="Buscar clientes..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{
                        color: 'var(--label-primary)',
                        fontSize: '16px',
                        fontFamily: 'inherit',
                    }}
                />
            </div>
        </div>
    );
}
