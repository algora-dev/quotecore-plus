import BlogHeader from '@/components/BlogHeader';
import SiteFooter from '@/components/SiteFooter';
import FreeToolsHub from './FreeToolsHub';
import s from './hub.module.css';
export default function FreeToolsPage(){return <>
 <a href="#free-tools-content" className={s.skipLink}>Skip to free tools</a>
 <BlogHeader/>
 <FreeToolsHub/>
 <SiteFooter/>
</>;}
