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
      </head>
      <body>{children}</body>
    </html>
  )
}
