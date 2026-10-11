import React from 'react';
function icono(nombre: string) {
  return function Icono({ className, size, ...rest }: any) {
    return (
      <svg className={className} width={size ?? 24} height={size ?? 24} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-icono={nombre} {...rest}>
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  };
}
export const Building2 = icono('Building2');
export const HardHat = icono('HardHat');
export const UserRound = icono('UserRound');
export const Sun = icono('Sun');
export const Moon = icono('Moon');
export const SunMoon = icono('SunMoon');
export const Monitor = icono('Monitor');
export const Package = icono('Package');
