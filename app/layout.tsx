import type { Metadata } from 'next';
import '@radix-ui/themes/styles.css';
import './globals.css';
export const metadata: Metadata = { title: 'Conversation | Understand each other', description: 'A simple workspace for English translations and useful conversation notes.' };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
