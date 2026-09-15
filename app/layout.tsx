import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'棱序 Primer Studio · 高通量引物设计',description:'每批最多 50 个基因，检索人源 RefSeq 转录本，设计完整 CDS 扩增引物候选，并前往 NCBI Primer-BLAST 验证。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>;}
