import './globals.css'

export const metadata = {
  title: 'FreddyFit TrainDesk',
  description: 'Personal Training Client Management',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
