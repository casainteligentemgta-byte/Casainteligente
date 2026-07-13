/** Clave temporal asignada al crear/habilitar acceso de un empleado. */
export const TEMP_PASSWORD = '12345678'

/** Roles que pueden resetear clave temporal de empleados. */
export const ROLES_RESET_PASSWORD = [
    'admin_dueno',
    'administrador_dueno',
    'admin_general',
    'administrador_general',
    'admin',
    'administrador',
    'super_admin',
] as const

/** Roles contables / financieros: NO pueden resetear claves. */
export const ROLES_SIN_RESET_PASSWORD = [
    'admin_contable',
    'administrador_contable',
    'contador',
    'contabilidad',
    'admin_financiero',
    'administrador_financiero',
] as const

export function normalizarRol(rol: string): string {
    return rol.trim().toLowerCase().replace(/\s+/g, '_')
}

export function puedeResetearPassword(roles: string[]): boolean {
    const norms = roles.map(normalizarRol).filter(Boolean)
    if (norms.length === 0) return false

    const tienePermitido = norms.some((r) =>
        (ROLES_RESET_PASSWORD as readonly string[]).includes(r),
    )
    if (!tienePermitido) return false

    // Si solo tiene roles contables (y aliases), bloquear
    const soloContable = norms.every((r) =>
        (ROLES_SIN_RESET_PASSWORD as readonly string[]).includes(r),
    )
    if (soloContable) return false

    // Si tiene contable Y también admin dueño/general, permitir
    return tienePermitido
}

export function debeCambiarPassword(appMetadata: Record<string, unknown> | undefined | null): boolean {
    if (!appMetadata) return false
    return appMetadata.must_change_password === true
}
