import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'My Book Feed',
    short_name: 'Book Feed',
    description: '노션 독서 기록과 자동으로 연결되는 나만의 책 피드',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-1024.png', sizes: '1024x1024', type: 'image/png' },
    ],
  };
}
