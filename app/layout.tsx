import type { Metadata, Viewport } from 'next';
import PwaRegister from './pwa-register';
import './globals.css';

export const metadata: Metadata = {
  title: 'My Book Feed',
  description: '노션 독서 기록과 자동으로 연결되는 나만의 책 피드',
  applicationName: 'My Book Feed',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Book Feed',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
