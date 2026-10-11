import React from 'react';
export default function Link({ href, children, prefetch, replace, scroll, ...rest }: any) {
  return <a href={typeof href === 'string' ? `#nav:${href}` : '#'} onClick={(e) => e.preventDefault()} {...rest}>{children}</a>;
}
