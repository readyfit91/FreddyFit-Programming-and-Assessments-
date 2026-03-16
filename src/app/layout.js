import './globals.css'

export const metadata = {
  title: 'FreddyFit TrainDesk',
  description: 'Personal Training Client Management',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FreddyFit" />
        <meta name="theme-color" content="#3a8fc2" />
      </head>
      <body>{children}</body>
    </html>
  )
}
