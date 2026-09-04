import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '买不买 · 听听朋友的真话',
  description: '发起一个购买咨询，邀请朋友投票并留下真实意见。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
