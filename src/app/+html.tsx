import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { palette } from '@/theme/tokens';

/**
 * Web shell. Browser defaults are someone else's design system — the white
 * load flash, blue selection, gray scrollbars, and tap flashes all read as
 * "template". Every pixel the browser contributes gets restated in the
 * app's own palette so the web build feels authored edge to edge.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>BALLAST</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: shellCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const shellCss = `
  html, body { background-color: ${palette.gunmetal}; }
  * { -webkit-tap-highlight-color: transparent; }
  ::selection { background: ${palette.schematicCyan}; color: ${palette.gunmetal}; }
  :focus-visible { outline: 2px solid ${palette.schematicCyan}; outline-offset: 2px; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: ${palette.gunmetal}; }
  ::-webkit-scrollbar-thumb { background: ${palette.surface}; border: 1px solid #1E2833; }
  ::-webkit-scrollbar-thumb:hover { background: #1E2833; }
`;
