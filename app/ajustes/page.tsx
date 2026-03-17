export default function AjustesPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: 'var(--bg-primary)' }}>
            <div
                className="flex items-center justify-center rounded-3xl mb-6"
                style={{ width: '80px', height: '80px', background: 'rgba(142,142,147,0.12)' }}
            >
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="5" stroke="#8E8E93" strokeWidth="2" />
                    <path d="M20 6v4M20 30v4M6 20h4M30 20h4M9.515 9.515l2.828 2.828M27.657 27.657l2.828 2.828M9.515 30.485l2.828-2.828M27.657 12.343l2.828-2.828" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </div>
            <h1 className="font-bold text-2xl mb-2" style={{ color: 'var(--label-primary)' }}>Ajustes</h1>
            <p className="text-center" style={{ color: 'var(--label-secondary)', fontSize: '15px' }}>
                Configuración del sistema próximamente
            </p>
        </div>
    );
}
